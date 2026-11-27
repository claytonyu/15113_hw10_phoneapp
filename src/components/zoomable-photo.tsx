// A pinchable photo viewport whose transforms stay on the UI thread.
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { ScreenMessage } from '@/components/journal-ui';
import { colors } from '@/constants/field-notes-theme';

const FIT_SCALE = 1;
const MAX_SCALE = 5;

/** Keeps magnification centered on the pinch and lets users inspect the enlarged image. */
export function ZoomablePhoto({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  const scale = useSharedValue(FIT_SCALE);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const pinching = useSharedValue(false);

  const pinch = usePinchGesture({
    onActivate: () => { pinching.value = true; },
    onUpdate: ({ scaleChange, focalX, focalY }) => {
      const next = clamp(scale.value * scaleChange, FIT_SCALE, MAX_SCALE);
      const ratio = next / scale.value;
      const centerX = focalX - width.value / 2;
      const centerY = focalY - height.value / 2;
      const limitX = (next - FIT_SCALE) * width.value / 2;
      const limitY = (next - FIT_SCALE) * height.value / 2;
      panX.value = clamp(centerX - (centerX - panX.value) * ratio, -limitX, limitX);
      panY.value = clamp(centerY - (centerY - panY.value) * ratio, -limitY, limitY);
      scale.value = next;
    },
    onFinalize: () => { pinching.value = false; },
  });

  const pan = usePanGesture({
    maxPointers: 1,
    onUpdate: ({ changeX, changeY }) => {
      if (pinching.value) return;
      const limitX = (scale.value - FIT_SCALE) * width.value / 2;
      const limitY = (scale.value - FIT_SCALE) * height.value / 2;
      panX.value = clamp(panX.value + changeX, -limitX, limitX);
      panY.value = clamp(panY.value + changeY, -limitY, limitY);
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: scale.value }],
  }));

  if (failed) return <ScreenMessage message="Couldn’t open this image. You can replace or delete it below." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          onLayout={({ nativeEvent }) => {
            width.set(nativeEvent.layout.width);
            height.set(nativeEvent.layout.height);
          }}
          style={{ flex: 1, overflow: 'hidden' }}
        >
          <Animated.View pointerEvents="none" style={[{ flex: 1 }, style]}>
            <Image source={uri} contentFit="contain" cachePolicy="memory" accessibilityLabel="Saved photo" onError={() => setFailed(true)} style={{ flex: 1 }} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}
