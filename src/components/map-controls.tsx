// Tappable map actions remain reachable even when map imagery is unavailable.
import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, Text } from 'react-native';

import { colors, spacing } from '@/constants/field-notes-theme';

const LOCATION_BUTTON_SIZE = 48;
const locationIcons = {
  following: require('@/assets/images/map-location/following.svg'),
  exploring: require('@/assets/images/map-location/exploring.svg'),
  finding: require('@/assets/images/map-location/finding.svg'),
  unavailable: require('@/assets/images/map-location/unavailable.svg'),
  offline: require('@/assets/images/map-location/offline.svg'),
};

export type MapLocationAppearance = keyof typeof locationIcons;

/** Shows the current follow or location state on a single map control. */
export function MapLocationButton({ appearance, label, busy, onPress }: {
  appearance: MapLocationAppearance;
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  const active = appearance === 'following';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => ({
        width: LOCATION_BUTTON_SIZE, height: LOCATION_BUTTON_SIZE,
        borderRadius: LOCATION_BUTTON_SIZE / 2,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: active ? colors.mapFollow : colors.mapControl,
        borderWidth: 1, borderColor: active ? colors.mapFollow : colors.mapControlBorder,
        boxShadow: '0 2px 6px #00000026',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Image source={locationIcons[appearance]} accessible={false} contentFit="contain" style={{ width: 24, height: 24 }} />
    </Pressable>
  );
}

/** Renders an icon with a visible label and a full-sized touch target. */
export function MapAction({
  icon, label, primary = false, disabled = false, onPress,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, minHeight: 62, borderRadius: 16, borderCurve: 'continuous',
        justifyContent: 'center', alignItems: 'center', padding: spacing.small, gap: 3,
        backgroundColor: primary ? colors.accent : colors.surface,
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <SymbolView name={icon} size={22} tintColor={colors.ink} />
      <Text style={{ color: colors.ink, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}
