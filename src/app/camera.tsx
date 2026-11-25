// Captures, reviews, and saves still images without microphone access.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JournalButton, JournalUnavailable, leaveScreen, ScreenMessage } from '@/components/journal-ui';
import { colors, spacing } from '@/constants/field-notes-theme';
import { useScreenAction } from '@/hooks/use-screen-action';
import type { Photo } from '@/lib/entries';
import { useJournal } from '@/lib/journal';
import { discardCapture } from '@/lib/photo-files';

const CAPTURE_QUALITY = 0.82;
const CAMERA_TIMEOUT_MS = 10_000;

/** Loads an optional replacement target before opening the camera. */
export default function CameraScreen() {
  const { replace } = useLocalSearchParams<{ replace?: string }>();
  const { entries, status } = useJournal();
  if (status !== 'ready') return <JournalUnavailable />;
  const entry = entries.find(({ id }) => id === replace);
  if (replace && entry?.kind !== 'photo') return <ScreenMessage message="This photo is no longer available." />;
  return <CameraEditor key={replace ?? 'draft'} existing={entry?.kind === 'photo' ? entry : undefined} />;
}

/** Keeps a capture in cache until the user accepts it or requests a retake. */
function CameraEditor({ existing }: { existing?: Photo }) {
  const { draftCoordinates, savePhoto } = useJournal();
  const [coordinates] = useState(() => existing ? existing.coordinates : draftCoordinates);
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const camera = useRef<CameraView>(null);
  const active = useRef(true);
  const saving = useRef(false);
  const captureFile = useRef<string | null>(null);
  const action = useScreenAction();
  const { setError } = action;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (captureFile.current && !saving.current) discardCapture(captureFile.current);
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state === 'active' && focused) {
        void refreshPermission().catch(() => setError('Couldn’t check camera access. Try again.'));
      } else if (state !== 'active') setReady(false);
    });
    return () => subscription.remove();
  }, [focused, refreshPermission, setError]);

  useEffect(() => {
    if (!permission?.granted || !focused || !appActive || ready || preview) return;
    const timeout = setTimeout(() => {
      setError('The camera is taking too long to start. Try restarting it.');
    }, CAMERA_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [permission?.granted, focused, appActive, ready, preview, attempt, setError]);

  /** Requests permission or points the user to settings after a permanent denial. */
  function enableCamera() {
    void action.run(async () => {
      if (permission?.canAskAgain === false) await Linking.openSettings();
      else await requestPermission();
    }, 'Couldn’t open camera permissions. Check your phone settings.');
  }

  /** Stores a JPEG preview to review before adding it to the journal. */
  function takePhoto() {
    if (!ready || !focused || !appActive) return;
    void action.run(async () => {
      const view = camera.current;
      if (!view) throw new Error('Camera view is unavailable.');

      let timedOut = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          timedOut = true;
          reject(new Error('Camera capture timed out.'));
        }, CAMERA_TIMEOUT_MS);
      });
      try {
        const capture = view.takePictureAsync({ quality: CAPTURE_QUALITY, exif: false }).then((photo) => {
          // A native capture can finish after the camera has been restarted.
          if (photo && (timedOut || !active.current)) discardCapture(photo.uri);
          return photo;
        });
        const photo = await Promise.race([capture, deadline]);
        if (!active.current) return;
        if (!photo) throw new Error('No image returned.');
        captureFile.current = photo.uri;
        setPreview(photo.uri);
      } finally {
        clearTimeout(timeout);
      }
    }, 'Couldn’t take a photo. Try again or restart the camera.');
  }

  /** Discards this preview and opens a fresh camera session. */
  function retake() {
    if (captureFile.current) discardCapture(captureFile.current);
    captureFile.current = null;
    setPreview(null);
    setReady(false);
    action.setError('');
  }

  /** Commits the reviewed image while keeping the preview available if saving fails. */
  function save() {
    if (!preview) return;
    const uri = preview;
    void action.run(async () => {
      saving.current = true;
      try {
        await savePhoto(uri, coordinates, existing);
        discardCapture(uri);
        captureFile.current = null;
      } finally {
        saving.current = false;
        if (!active.current && captureFile.current) discardCapture(captureFile.current);
      }
    }, 'Couldn’t save this photo. Your preview is still here. Try again.', leaveScreen);
  }

  /** Reopens a failed camera session without changing placement. */
  function retryCamera() {
    setReady(false);
    action.setError('');
    setAttempt((previous) => previous + 1);
  }

  if (!permission) return <ScreenMessage message="Checking camera access…" loading />;
  if (!permission.granted) {
    return (
      <ScrollView contentContainerStyle={{ alignItems: 'flex-start', padding: spacing.large, gap: spacing.medium }}>
        <Text style={{ color: colors.ink, fontSize: 17 }}>Allow camera access to take a photo for your journal.</Text>
        <JournalButton label={permission.canAskAgain ? 'Allow camera' : 'Open settings'} disabled={action.busy} onPress={enableCamera} />
        {!!action.error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{action.error}</Text>}
      </ScrollView>
    );
  }

  const shutterDisabled = !ready || !focused || !appActive || action.busy;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: existing ? 'Replace photo' : 'Camera' }} />
      <View style={{ flex: 1, backgroundColor: colors.dark }}>
        {preview ? (
          <Image source={preview} contentFit="contain" cachePolicy="none" accessibilityLabel="Captured photo preview" style={{ flex: 1 }} />
        ) : focused && appActive && (
          <CameraView
            key={attempt}
            ref={camera}
            style={{ flex: 1 }}
            facing="back"
            mode="picture"
            onCameraReady={() => setReady(true)}
            onMountError={() => { setReady(false); action.setError('The camera couldn’t start. Try reopening it.'); }}
          />
        )}
      </View>
      <View style={{ padding: spacing.medium, gap: spacing.small }}>
        {!coordinates && <Text style={{ color: colors.muted }}>This photo has no map location.</Text>}
        {!!action.error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{action.error}</Text>}
        <View style={{ flexDirection: 'row', gap: spacing.small, flexWrap: 'wrap' }}>
          {preview ? (
            <>
              <JournalButton label={action.busy ? 'Saving…' : 'Save photo'} disabled={action.busy} onPress={save} />
              <JournalButton label="Discard and retake" secondary disabled={action.busy} onPress={retake} />
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                accessibilityState={{ disabled: shutterDisabled, busy: action.busy }}
                disabled={shutterDisabled}
                onPress={takePhoto}
                style={({ pressed }) => ({
                  minHeight: 48, paddingHorizontal: spacing.large, borderRadius: 12,
                  justifyContent: 'center', backgroundColor: colors.accent,
                  opacity: pressed || shutterDisabled ? 0.6 : 1,
                })}
              >
                <Text style={{ color: colors.ink, fontWeight: '600' }}>
                  {action.busy ? 'Capturing…' : ready ? 'Take photo' : 'Starting camera…'}
                </Text>
              </Pressable>
              {!!action.error && <JournalButton label="Restart camera" secondary onPress={retryCamera} />}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
