// A single route for writing and editing multiline notes.
import { Host, TextInput, useNativeState } from '@expo/ui';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { JournalButton, JournalUnavailable, leaveScreen, ScreenMessage } from '@/components/journal-ui';
import { colors, spacing } from '@/constants/field-notes-theme';
import { useScreenAction } from '@/hooks/use-screen-action';
import type { Note } from '@/lib/entries';
import { useJournal } from '@/lib/journal';

/** Finds the requested note before initializing the editor's draft. */
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { entries, status } = useJournal();
  const action = useScreenAction();
  if (status !== 'ready') return <JournalUnavailable />;
  const entry = entries.find((item) => item.id === id);
  if (id && entry?.kind !== 'note') return <ScreenMessage message="This note is no longer available." />;
  return <NoteEditor key={id ?? 'draft'} note={entry?.kind === 'note' ? entry : undefined} action={action} />;
}

/** Keeps the original location while an existing note's text is edited. */
function NoteEditor({ note, action }: { note?: Note; action: ReturnType<typeof useScreenAction> }) {
  const { draftCoordinates, saveNote, deleteEntry } = useJournal();
  const [coordinates] = useState(() => note ? note.coordinates : draftCoordinates);
  const title = useNativeState(note?.title ?? '');
  const body = useNativeState(note?.body ?? '');

  /** Validates the title without discarding the text on save failure. */
  function save() {
    const trimmedTitle = title.value.trim();
    if (!trimmedTitle) {
      action.setError('Enter a title for this note.');
      return;
    }
    void action.run(
      () => saveNote({ title: trimmedTitle, body: body.value, coordinates }, note),
      'Couldn’t save this note. Your text is still here. Try again.',
      leaveScreen,
    );
  }

  /** Asks for confirmation before permanently removing the note. */
  function confirmDelete(existing: Note) {
    Alert.alert('Delete note?', 'This permanently removes the note from your journal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { void action.run(() => deleteEntry(existing), 'Couldn’t delete this note. Try again.', leaveScreen); },
      },
    ]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1, padding: spacing.large, gap: spacing.medium }}
    >
      <Stack.Screen options={{ title: note ? 'Edit note' : 'New note' }} />
      {!coordinates && <Text style={{ color: colors.muted }}>This note has no map location.</Text>}
      <Text style={{ color: colors.ink, fontWeight: '700' }}>Title</Text>
      <Host matchContents={{ vertical: true }}>
        <TextInput
          value={title}
          editable={!action.busy}
          accessibilityLabel="Note title"
          placeholder="Give this note a title"
          style={fieldStyle}
          textStyle={{ color: colors.ink, fontSize: 17 }}
        />
      </Host>
      <Text style={{ color: colors.ink, fontWeight: '700' }}>Note</Text>
      <Host matchContents={{ vertical: true }}>
        <TextInput
          value={body}
          editable={!action.busy}
          accessibilityLabel="Note body"
          placeholder="Write your observations"
          multiline
          numberOfLines={8}
          style={fieldStyle}
          textStyle={{ color: colors.ink, fontSize: 17 }}
        />
      </Host>
      {!!action.error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{action.error}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small }}>
        <JournalButton label={action.busy ? 'Working…' : 'Save note'} disabled={action.busy} onPress={save} />
        {note && <JournalButton label="Delete note" secondary disabled={action.busy} onPress={() => confirmDelete(note)} />}
      </View>
    </ScrollView>
  );
}

const fieldStyle = {
  backgroundColor: colors.surface, borderColor: colors.line,
  borderWidth: 1, borderRadius: 12, padding: spacing.medium,
};
