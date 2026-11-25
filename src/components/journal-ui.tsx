// Shared controls and states for the storage-backed screens.
import { Button, Host } from '@expo/ui';
import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/field-notes-theme';
import { useJournal } from '@/lib/journal';

/** Renders a native action with a consistent touch target and palette. */
export function JournalButton({
  label, onPress, secondary = false, disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Host matchContents>
      <Button
        label={label}
        onPress={onPress}
        disabled={disabled}
        variant={secondary ? 'outlined' : 'filled'}
        style={{ height: 48, paddingHorizontal: spacing.large, backgroundColor: secondary ? undefined : colors.accent }}
      />
    </Host>
  );
}

/** Displays feedback without exposing database paths, coordinates, or capture details. */
export function ScreenMessage({ message, loading = false }: { message: string; loading?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.extraLarge, gap: spacing.medium }}>
      {loading && <ActivityIndicator color={colors.accentDark} />}
      <Text accessibilityLiveRegion="polite" selectable style={{ color: colors.muted, textAlign: 'center', fontSize: 16 }}>
        {message}
      </Text>
    </View>
  );
}

/** Allows a failed storage load to be retried from an affected screen. */
export function JournalUnavailable() {
  const { status, retry } = useJournal();
  if (process.env.EXPO_OS === 'web') {
    return <ScreenMessage message="Open Field Notes in Expo Go on an iPhone or Android phone." />;
  }
  if (status === 'loading') return <ScreenMessage message="Opening your journal…" loading />;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.medium }}>
      <Text accessibilityRole="alert" style={{ color: colors.danger }}>Couldn’t open your journal.</Text>
      <JournalButton label="Try again" onPress={retry} />
    </View>
  );
}

/** Returns to the previous screen, including when a route was opened directly. */
export function leaveScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
