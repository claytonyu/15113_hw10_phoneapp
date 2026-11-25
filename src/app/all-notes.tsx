// Scrollable journal for all entries, also used to browse overlapping map pins.
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JournalUnavailable, ScreenMessage } from '@/components/journal-ui';
import { colors, spacing } from '@/constants/field-notes-theme';
import type { Entry } from '@/lib/entries';
import { useJournal } from '@/lib/journal';
import { photoFile } from '@/lib/photo-files';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Shows photos and notes together in descending creation order. */
export default function AllNotesScreen() {
  const { cluster } = useLocalSearchParams<{ cluster?: string }>();
  const { entries, status } = useJournal();
  if (status !== 'ready') return <JournalUnavailable />;
  const included = cluster ? new Set(cluster.split(',')) : null;
  const visibleEntries = included ? entries.filter((entry) => included.has(entry.id)) : entries;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
      {included && <Stack.Screen options={{ title: 'Entries at this spot' }} />}
      <FlatList
        data={visibleEntries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <EntryRow entry={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1, padding: spacing.large, gap: spacing.medium }}
        ListEmptyComponent={<ScreenMessage message={included ? 'No entries remain here.' : 'Your saved notes and photos will appear here.'} />}
      />
    </SafeAreaView>
  );
}

/** Provides a thumbnail or note title and opens the corresponding detail screen. */
function EntryRow({ entry }: { entry: Entry }) {
  const isPhoto = entry.kind === 'photo';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: isPhoto ? '/photo' : '/note', params: { id: entry.id } })}
      style={({ pressed }) => ({
        minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.medium,
        padding: spacing.medium, backgroundColor: colors.surface, borderRadius: 15,
        borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.75 : 1,
      })}
    >
      {isPhoto && (
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
          {isPhoto ? 'Photo' : entry.title}
        </Text>
        <Text style={{ color: colors.muted }}>{dateFormat.format(entry.created)}</Text>
        {!entry.coordinates && <Text style={{ color: colors.muted }}>No map location</Text>}
      </View>
    </Pressable>
  );
}
