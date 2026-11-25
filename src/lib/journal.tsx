// The shared journal contract used by the map, list, and editors.
import { createContext, use } from 'react';

import type { Coordinates, Entry, Note, Photo } from '@/lib/entries';

type Journal = {
  entries: Entry[];
  status: 'loading' | 'ready' | 'error';
  retry: () => void;
  saveNote: (draft: Pick<Note, 'title' | 'body' | 'coordinates'>, existing?: Note) => Promise<void>;
  savePhoto: (uri: string, coordinates: Coordinates | null, existing?: Photo) => Promise<void>;
  deleteEntry: (entry: Entry) => Promise<void>;
  beginDraft: (coordinates: Coordinates | null) => void;
  draftCoordinates: Coordinates | null;
};

export const JournalContext = createContext<Journal | null>(null);

/** Reads the journal from a screen inside the root layout. */
export function useJournal() {
  const journal = use(JournalContext);
  if (!journal) throw new Error('JournalProvider is required.');
  return journal;
}
