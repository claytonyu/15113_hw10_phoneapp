// Displays a saved photo and provides its replacement and deletion actions.
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmEntryDeletion, JournalButton, JournalUnavailable, leaveScreen, ScreenMessage } from '@/components/journal-ui';
import { ZoomablePhoto } from '@/components/zoomable-photo';
import { colors, spacing } from '@/constants/field-notes-theme';
import { useScreenAction } from '@/hooks/use-screen-action';
import type { Photo } from '@/lib/entries';
import { useJournal } from '@/lib/journal';
import { photoFile } from '@/lib/photo-files';

/** Opens the saved file and updates the display if the user replaces it. */
export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { entries, status, deleteEntry } = useJournal();
  const action = useScreenAction();
  const entry = entries.find((item) => item.id === id);
  if (status !== 'ready') return <JournalUnavailable />;
  if (entry?.kind !== 'photo') return <ScreenMessage message="This photo is no longer available." />;

  /** Reports a failure while keeping the photo's delete action available. */
  function deletePhoto(photo: Photo) {
    void action.run(() => deleteEntry(photo), 'Couldn’t finish deleting this photo. Try again.', leaveScreen);
  }

  /** Asks for confirmation before deleting the photo record and its stored file. */
  function confirmDelete(photo: Photo) {
    confirmEntryDeletion(photo, () => deletePhoto(photo));
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
      {entry.deletionPending
        ? <ScreenMessage message={action.busy ? 'Deleting photo…' : 'Photo deletion is pending.'} />
        : <ZoomablePhoto key={entry.filename} uri={photoFile(entry.filename).uri} />}
      <View style={{ padding: spacing.medium, gap: spacing.small }}>
        {!!action.error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{action.error}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small }}>
          {!entry.deletionPending && (
            <JournalButton label="Replace photo" disabled={action.busy} onPress={() => router.push({ pathname: '/camera', params: { replace: entry.id } })} />
          )}
          <JournalButton
            label={entry.deletionPending ? 'Retry deletion' : 'Delete photo'}
            disabled={action.busy}
            onPress={() => entry.deletionPending ? deletePhoto(entry) : confirmDelete(entry)}
            variant="destructive"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
