// SQLite is the local source of truth. Coordinates are optional for offline entries.
import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { Coordinates, Entry, Note, Photo } from '@/lib/entries';
import { persistPhoto, removePhotoFile } from '@/lib/photo-files';

type EntryRow = {
  id: string;
  kind: Entry['kind'];
  created: number;
  modified: number;
  title: string;
  body: string;
  filename: string;
  deletionPending: number;
  latitude: number | null;
  longitude: number | null;
};

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA secure_delete = ON;
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created INTEGER NOT NULL,
    modified INTEGER NOT NULL,
    latitude REAL,
    longitude REAL
  );
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY NOT NULL,
    filename TEXT NOT NULL,
    created INTEGER NOT NULL,
    latitude REAL,
    longitude REAL
  );
  CREATE TABLE IF NOT EXISTS photo_cleanup (filename TEXT PRIMARY KEY NOT NULL);
  CREATE TABLE IF NOT EXISTS photo_deletions (id TEXT PRIMARY KEY NOT NULL);
  CREATE TRIGGER IF NOT EXISTS queue_deleted_photo AFTER DELETE ON photos
    BEGIN INSERT OR IGNORE INTO photo_cleanup VALUES (OLD.filename); END;
  CREATE TRIGGER IF NOT EXISTS queue_replaced_photo AFTER UPDATE OF filename ON photos
    BEGIN INSERT OR IGNORE INTO photo_cleanup VALUES (OLD.filename); END;
`;

let opening: Promise<SQLiteDatabase> | undefined;

/** Opens one connection for the app and allows retrying a failed initialization. */
export function openEntriesDatabase() {
  opening ??= initializeDatabase().catch((error: unknown) => {
    opening = undefined;
    throw error;
  });
  return opening;
}

/** Initializes tables and retries cleanup interrupted by a prior app exit. */
async function initializeDatabase() {
  const db = await openDatabaseAsync('field-notes.db');
  try {
    await db.execAsync(SCHEMA);
    await resumePhotoDeletions(db);
    await clearRetiredPhotos(db);
    return db;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}

/** Converts nullable SQLite coordinates into the app's optional location. */
function toEntry(row: EntryRow): Entry {
  const { id, created, kind, latitude, longitude } = row;
  const coordinates = latitude === null || longitude === null ? null : { latitude, longitude };
  if (kind === 'photo') {
    return { id, kind, created, coordinates, filename: row.filename, deletionPending: row.deletionPending === 1 };
  }
  return { id, kind, created, coordinates, title: row.title, body: row.body, modified: row.modified };
}

/** Loads the mixed journal in creation order, including unlocated entries. */
export async function loadEntries(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<EntryRow>(`
    SELECT id, 'note' AS kind, created, modified, title, body, '' AS filename, latitude, longitude, 0 AS deletionPending
    FROM notes
    UNION ALL
    SELECT id, 'photo', created, created, '', '', filename, latitude, longitude,
      EXISTS (SELECT 1 FROM photo_deletions WHERE photo_deletions.id = photos.id)
    FROM photos
    ORDER BY created DESC, id DESC
  `);
  return rows.map(toEntry);
}

/** Saves a note while preserving the original date and coordinates on edit. */
export async function writeNote(
  db: SQLiteDatabase,
  draft: Pick<Note, 'title' | 'body' | 'coordinates'>,
  existing?: Note,
): Promise<Note> {
  const modified = Date.now();
  if (existing) {
    const result = await db.runAsync(
      'UPDATE notes SET title = ?, body = ?, modified = ? WHERE id = ?',
      draft.title, draft.body, modified, existing.id,
    );
    if (!result.changes) throw new Error('Note no longer exists.');
    return { ...existing, title: draft.title, body: draft.body, modified };
  }

  const note: Note = { ...draft, kind: 'note', id: randomUUID(), created: modified, modified };
  await db.runAsync(
    'INSERT INTO notes (id, title, body, created, modified, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
    note.id, note.title, note.body, note.created, note.modified,
    note.coordinates?.latitude ?? null, note.coordinates?.longitude ?? null,
  );
  return note;
}

/** Cleans files queued by a committed change, retaining failed deletions for retry. */
async function clearRetiredPhotos(db: SQLiteDatabase) {
  try {
    const files = await db.getAllAsync<{ filename: string }>('SELECT filename FROM photo_cleanup');
    for (const { filename } of files) {
      try {
        await removePhotoFile(filename);
        await db.runAsync('DELETE FROM photo_cleanup WHERE filename = ?', filename);
      } catch {
        // Keep the cleanup record until the file can be removed.
      }
    }
  } catch {
    // A cleanup failure must not hide accessible journal entries.
  }
}

/** Commits a new capture or replacement after it reaches persistent storage. */
export async function writePhoto(
  db: SQLiteDatabase,
  uri: string,
  coordinates: Coordinates | null,
  existing?: Photo,
): Promise<Photo> {
  const filename = `${randomUUID()}.jpg`;
  const photo: Photo = existing
    ? { ...existing, filename }
    : { kind: 'photo', id: randomUUID(), created: Date.now(), coordinates, filename };

  // Queue the new file first so a crash before the transaction cannot orphan it.
  await db.runAsync('INSERT INTO photo_cleanup VALUES (?)', filename);
  try {
    await persistPhoto(uri, filename);
    await db.withExclusiveTransactionAsync(async (transaction) => {
      if (existing) {
        const result = await transaction.runAsync(
          `UPDATE photos SET filename = ? WHERE id = ?
            AND NOT EXISTS (SELECT 1 FROM photo_deletions WHERE photo_deletions.id = photos.id)`,
          filename, existing.id,
        );
        if (!result.changes) throw new Error('Photo is no longer available to replace.');
      } else {
        await transaction.runAsync(
          'INSERT INTO photos (id, filename, created, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
          photo.id, filename, photo.created, coordinates?.latitude ?? null, coordinates?.longitude ?? null,
        );
      }
      await transaction.runAsync('DELETE FROM photo_cleanup WHERE filename = ?', filename);
    });
  } finally {
    await clearRetiredPhotos(db);
  }
  return photo;
}

/** Deletes a text note, which has no separate file to remove. */
export async function eraseNote(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}

/** Records a deletion before touching the file so an interrupted delete can resume. */
export async function queuePhotoDeletion(db: SQLiteDatabase, id: string) {
  await db.runAsync('INSERT OR IGNORE INTO photo_deletions SELECT id FROM photos WHERE id = ?', id);
}

/** Removes the current file before finalizing the journal record. Safe to retry. */
export async function finishPhotoDeletion(db: SQLiteDatabase, id: string) {
  const photo = await db.getFirstAsync<{ filename: string }>(
    'SELECT filename FROM photos INNER JOIN photo_deletions USING (id) WHERE id = ?', id,
  );
  if (!photo) return;

  await removePhotoFile(photo.filename);
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM photos WHERE id = ?', id);
    // The existing deletion trigger queues the file, which has already been removed.
    await transaction.runAsync('DELETE FROM photo_cleanup WHERE filename = ?', photo.filename);
    await transaction.runAsync('DELETE FROM photo_deletions WHERE id = ?', id);
  });
}

/** Retries interrupted deletions while keeping failures available in the journal. */
async function resumePhotoDeletions(db: SQLiteDatabase) {
  const pending = await db.getAllAsync<{ id: string }>('SELECT id FROM photo_deletions');
  for (const { id } of pending) {
    try {
      await finishPhotoDeletion(db, id);
    } catch {
      // Keep the intent and the photo entry so the user can try again.
    }
  }
}
