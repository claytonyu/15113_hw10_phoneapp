// Scrollable journal for all entries, also used to browse overlapping map pins.
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmEntryDeletion, JournalUnavailable, ScreenMessage } from '@/components/journal-ui';
import { colors, spacing } from '@/constants/field-notes-theme';
import { useScreenAction } from '@/hooks/use-screen-action';
import type { Entry } from '@/lib/entries';
import { useJournal } from '@/lib/journal';
import { photoFile } from '@/lib/photo-files';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Shows photos and notes together in descending creation order. */
export default function AllNotesScreen() {
  const { cluster } = useLocalSearchParams<{ cluster?: string }>();
  const { entries, status, deleteEntry } = useJournal();
  const action = useScreenAction();
  if (status !== 'ready') return <JournalUnavailable />;
  const included = cluster ? new Set(cluster.split(',')) : null;
  const visibleEntries = included ? entries.filter((entry) => included.has(entry.id)) : entries;

  /** Deletes from the list after confirmation without navigating away. */
  function confirmDelete(entry: Entry) {
    confirmEntryDeletion(entry, () => {
      void action.run(() => deleteEntry(entry), `Couldn’t delete this ${entry.kind}. Try again.`);
    });
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
      {included && <Stack.Screen options={{ title: 'Entries at this spot' }} />}
      {!!action.error && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger, padding: spacing.large }}>
          {action.error}
        </Text>
      )}
      <FlatList
        data={visibleEntries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => (
          <EntryRow entry={item} onDelete={included ? undefined : confirmDelete} deleting={action.busy} />
        )}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1, padding: spacing.large, gap: spacing.medium }}
        ListEmptyComponent={<ScreenMessage message={included ? 'No entries remain here.' : 'Your saved notes and photos will appear here.'} />}
      />
    </SafeAreaView>
  );
}

/** Keeps opening an entry and deleting it as separate touch targets. */
function EntryRow({ entry, onDelete, deleting }: {
  entry: Entry;
  onDelete?: (entry: Entry) => void;
  deleting: boolean;
}) {
  const isPhoto = entry.kind === 'photo';
  const created = dateFormat.format(entry.created);
  const deleteLabel = isPhoto
    ? `${entry.deletionPending ? 'Retry deletion of photo' : 'Delete photo'} from ${created}`
    : `Delete note: ${entry.title}`;
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: isPhoto ? '/photo' : '/note', params: { id: entry.id } })}
        style={({ pressed }) => ({
          flex: 1, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.medium,
          padding: spacing.medium, opacity: pressed ? 0.75 : 1,
        })}
      >
        {isPhoto && !entry.deletionPending && (
          <Image
            source={photoFile(entry.filename).uri}
            accessibilityLabel="Photo thumbnail"
            recyclingKey={entry.filename}
            cachePolicy="memory"
            contentFit="cover"
            style={{ width: 62, height: 62, borderRadius: 8, backgroundColor: colors.line }}
          />
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 17, fontWeight: '700' }}>
            {isPhoto ? (entry.deletionPending ? 'Photo deletion pending' : 'Photo') : entry.title}
          </Text>
          <Text style={{ color: colors.muted }}>{created}</Text>
          {!entry.coordinates && <Text style={{ color: colors.muted }}>No map location</Text>}
        </View>
      </Pressable>
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          accessibilityState={{ disabled: deleting }}
          disabled={deleting}
          onPress={() => onDelete(entry)}
          style={({ pressed }) => ({
            width: 48, height: 48, alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
            marginRight: spacing.small, opacity: pressed || deleting ? 0.5 : 1,
          })}
        >
          <Text allowFontScaling={false} style={{ color: colors.danger, fontSize: 24 }}>×</Text>
        </Pressable>
      )}
    </View>
  );
}
