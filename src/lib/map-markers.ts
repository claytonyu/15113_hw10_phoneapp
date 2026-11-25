// Groups visible entries at the current map scale without another native library.
import type { Region } from 'react-native-maps';

import type { Coordinates, Entry } from '@/lib/entries';

type LocatedEntry = Entry & { coordinates: Coordinates };
type MarkerGroup = { key: string; entries: LocatedEntry[]; coordinates: Coordinates };

const MARKER_SPACING = 54;

/** Keeps distances and marker positions consistent across the antimeridian. */
function wrapLongitude(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

/** Groups entries whose positions fall in the same screen-sized grid cell. */
export function groupMapMarkers(
  entries: Entry[],
  region: Region,
  size: { width: number; height: number },
): MarkerGroup[] {
  if (!size.width || !size.height || region.latitudeDelta <= 0 || region.longitudeDelta <= 0) return [];
  const cells = new Map<string, { entries: LocatedEntry[]; latitude: number; longitudeOffset: number }>();

  for (const entry of entries) {
    if (!entry.coordinates) continue;
    const { latitude, longitude } = entry.coordinates;
    const longitudeOffset = wrapLongitude(longitude - region.longitude);
    const x = (longitudeOffset / region.longitudeDelta + 0.5) * size.width;
    const y = ((region.latitude - latitude) / region.latitudeDelta + 0.5) * size.height;
    if (x < 0 || x > size.width || y < 0 || y > size.height) continue;

    const key = `${Math.floor(x / MARKER_SPACING)}:${Math.floor(y / MARKER_SPACING)}`;
    const cell = cells.get(key) ?? { entries: [], latitude: 0, longitudeOffset: 0 };
    cell.entries.push({ ...entry, coordinates: entry.coordinates });
    cell.latitude += latitude;
    cell.longitudeOffset += longitudeOffset;
    cells.set(key, cell);
  }

  return Array.from(cells, ([key, cell]) => ({
    key: cell.entries.length === 1 ? cell.entries[0].id : key,
    entries: cell.entries,
    coordinates: {
      latitude: cell.latitude / cell.entries.length,
      longitude: wrapLongitude(region.longitude + cell.longitudeOffset / cell.entries.length),
    },
  }));
}
