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
};

export type Entry = Note | Photo;
