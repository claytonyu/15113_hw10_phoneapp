// Captures, reviews, and saves still images without microphone access.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JournalButton, JournalUnavailable, leaveScreen, ScreenMessage } from '@/components/journal-ui';
import { colors, spacing } from '@/constants/field-notes-theme';
import { useScreenAction } from '@/hooks/use-screen-action';
import type { Photo } from '@/lib/entries';
import { useJournal } from '@/lib/journal';
import { discardCapture } from '@/lib/photo-files';

const CAPTURE_QUALITY = 0.82;

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
    if (!focused) return;
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state === 'active') {
        void refreshPermission().catch(() => setError('Couldn’t check camera access. Try again.'));
      } else setReady(false);
    });
    return () => subscription.remove();
  }, [focused, refreshPermission, setError]);

  /** Requests permission or points the user to settings after a permanent denial. */
  function enableCamera() {
    void action.run(async () => {
      if (permission?.canAskAgain === false) await Linking.openSettings();
      else await requestPermission();
    }, 'Couldn’t open camera permissions. Check your phone settings.');
  }

  /** Stores a JPEG preview to review before adding it to the journal. */
  function takePhoto() {
    const view = camera.current;
    if (!view || !ready) return;
    void action.run(async () => {
      const photo = await view.takePictureAsync({ quality: CAPTURE_QUALITY, exif: false });
      if (!photo) throw new Error('No image returned.');
      if (!active.current) {
        discardCapture(photo.uri);
        return;
      }
      captureFile.current = photo.uri;
      setPreview(photo.uri);
    }, 'Couldn’t take a photo. Try again.');
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

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: existing ? 'Replace photo' : 'Camera' }} />
      <View style={{ flex: 1, backgroundColor: colors.dark }}>
        {preview ? (
          <Image source={preview} contentFit="contain" cachePolicy="none" accessibilityLabel="Captured photo preview" style={{ flex: 1 }} />
        ) : focused && appActive && (
          <CameraView
            key={attempt}
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
              <JournalButton label={action.busy ? 'Capturing…' : 'Take photo'} disabled={!ready || action.busy} onPress={takePhoto} />
              {!ready && !!action.error && <JournalButton label="Retry camera" secondary onPress={retryCamera} />}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
