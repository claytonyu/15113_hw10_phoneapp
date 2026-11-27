// Shared controls and states for the storage-backed screens.
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/field-notes-theme';
import type { Entry } from '@/lib/entries';
import { useJournal } from '@/lib/journal';

/** Uses one surface for both the button color and its touch target. */
export function JournalButton({
  label, onPress, variant = 'primary', disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
}) {
  const primary = variant === 'primary';
  const outlined = variant === 'secondary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        maxWidth: '100%',
        paddingHorizontal: spacing.medium,
        paddingVertical: spacing.small,
        borderRadius: 12,
        borderCurve: 'continuous',
        borderWidth: outlined ? 1 : 0,
        borderColor: colors.line,
        backgroundColor: primary ? colors.accent : outlined ? colors.surface : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: variant === 'destructive' ? colors.danger : colors.ink, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
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

/** Confirms permanent deletion from either the list or the detail screen. */
export function confirmEntryDeletion(entry: Entry, onConfirm: () => void) {
  const subject = entry.kind === 'note' ? `“${entry.title}”` : 'this photo';
  Alert.alert(`Delete ${entry.kind}?`, `Are you sure you want to permanently delete ${subject}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

/** Returns to the previous screen, including when a route was opened directly. */
export function leaveScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
