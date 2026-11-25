// Shared types for notes and photos saved on this device.
export type Coordinates = Readonly<{ latitude: number; longitude: number }>;

type EntryBase = {
  id: string;
  created: number;
  coordinates: Coordinates | null;
};

export type Note = EntryBase & {
  kind: 'note';
  title: string;
  body: string;
  modified: number;
};

export type Photo = EntryBase & {
  kind: 'photo';
  filename: string;
  deletionPending?: boolean;
};

export type Entry = Note | Photo;

/** Matches SQLite's creation order and binary comparison for UUIDs. */
export function compareEntryCreation(a: Entry, b: Entry) {
  if (a.created !== b.created) return b.created - a.created;
  if (a.id < b.id) return 1;
  if (a.id > b.id) return -1;
  return 0;
}
