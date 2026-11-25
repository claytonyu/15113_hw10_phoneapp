// Keeps the visible journal in sync with committed SQLite changes.
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';

import { compareEntryCreation, type Coordinates, type Entry, type Note, type Photo } from '@/lib/entries';
import { eraseNote, finishPhotoDeletion, loadEntries, openEntriesDatabase, queuePhotoDeletion, writeNote, writePhoto } from '@/lib/entries-db';
import { JournalContext } from '@/lib/journal';

/** Provides local data and keeps the new entry's location out of navigation URLs. */
export function JournalProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [draftCoordinates, setDraftCoordinates] = useState<Coordinates | null>(null);
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    openEntriesDatabase().then(loadEntries).then(
      (saved) => {
        if (!active) return;
        setEntries(saved);
        setStatus('ready');
      },
      () => {
        if (active) setStatus('error');
      },
    );
    return () => { active = false; };
  }, [attempt]);

  /** Retries opening or reading local storage. */
  function retry() {
    setStatus('loading');
    setAttempt((previous) => previous + 1);
  }

  /** Serializes writes so cleanup never races an in-progress photo save. */
  function commit(change: () => Promise<void>) {
    const result = pendingWrite.current.then(change);
    pendingWrite.current = result.catch(() => {});
    return result;
  }

  /** Keeps the creation order while replacing an entry in place. */
  function recordSaved(entry: Entry, existing?: Entry) {
    setEntries((previous) => existing
      ? previous.map((saved) => saved.id === entry.id ? entry : saved)
      : [entry, ...previous].sort(compareEntryCreation));
  }

  /** Persists a note before exposing the change to other screens. */
  function saveNote(draft: Pick<Note, 'title' | 'body' | 'coordinates'>, existing?: Note) {
    return commit(async () => {
      const db = await openEntriesDatabase();
      recordSaved(await writeNote(db, draft, existing), existing);
    });
  }

  /** Persists a photo before exposing the change to other screens. */
  function savePhoto(uri: string, coordinates: Coordinates | null, existing?: Photo) {
    return commit(async () => {
      const db = await openEntriesDatabase();
      recordSaved(await writePhoto(db, uri, coordinates, existing), existing);
    });
  }

  /** Keeps unfinished photo deletions in the journal so they can be retried. */
  function deleteEntry(entry: Entry) {
    return commit(async () => {
      const db = await openEntriesDatabase();
      if (entry.kind === 'photo') {
        await queuePhotoDeletion(db, entry.id);
        setEntries((previous) => previous.map((saved) => saved.kind === 'photo' && saved.id === entry.id
          ? { ...saved, deletionPending: true }
          : saved));
        await finishPhotoDeletion(db, entry.id);
      } else {
        await eraseNote(db, entry.id);
      }
      setEntries((previous) => previous.filter((saved) => saved.id !== entry.id));
    });
  }

  return (
    <JournalContext value={{
      entries, status, retry, saveNote, savePhoto, deleteEntry,
      beginDraft: setDraftCoordinates, draftCoordinates,
    }}>
      {children}
    </JournalContext>
  );
}
