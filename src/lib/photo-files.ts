// Camera previews live in cache. Saved photos use an app-private directory.
import { Directory, File, Paths } from 'expo-file-system';

/** Resolves a database filename in the current app sandbox. */
export function photoFile(filename: string) {
  return new File(Paths.document, 'field-notes-photos', filename);
}

/** Copies a capture before committing its database record. */
export async function persistPhoto(uri: string, filename: string) {
  const directory = new Directory(Paths.document, 'field-notes-photos');
  directory.create({ idempotent: true, intermediates: true });
  await new File(uri).copy(photoFile(filename));
}

/** Removes a stored image if it is still present. */
export function removePhotoFile(filename: string) {
  const file = photoFile(filename);
  if (file.exists) file.delete();
}

/** Removes a camera preview without making cache cleanup a condition of saving. */
export function discardCapture(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The operating system can reclaim temporary captures.
  }
}
