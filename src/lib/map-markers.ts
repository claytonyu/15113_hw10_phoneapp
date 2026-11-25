// Groups native screen points without losing the entries behind an overlapping pin.
import type { Point } from 'react-native-maps';

import type { Coordinates, Entry } from '@/lib/entries';

export type LocatedEntry = Entry & { coordinates: Coordinates };
export type MarkerGroup = { key: string; entries: LocatedEntry[]; coordinates: Coordinates };

const MARKER_SPACING = 54;

/** Lets the native map render a pin at the original coordinate. */
export function singleMarker(entry: LocatedEntry): MarkerGroup {
  return { key: entry.id, entries: [entry], coordinates: entry.coordinates };
}

/** Groups visible pins around nearby anchors, including across grid boundaries. */
export function groupMapMarkers(
  projected: { entry: LocatedEntry; point: Point }[],
  size: { width: number; height: number },
): MarkerGroup[] {
  const groups: MarkerGroup[] = [];
  const cells = new Map<string, { point: Point; group: MarkerGroup }[]>();

  for (const { entry, point } of projected) {
    const { x, y } = point;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > size.width || y < 0 || y > size.height) {
      continue;
    }

    const column = Math.floor(x / MARKER_SPACING);
    const row = Math.floor(y / MARKER_SPACING);
    let closest: MarkerGroup | undefined;
    let closestDistance = MARKER_SPACING ** 2;

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const neighbors = cells.get(`${column + dx}:${row + dy}`) ?? [];
        for (const anchor of neighbors) {
          const distance = (x - anchor.point.x) ** 2 + (y - anchor.point.y) ** 2;
          if (distance <= closestDistance) {
            closest = anchor.group;
            closestDistance = distance;
          }
        }
      }
    }

    if (closest) {
      closest.entries.push(entry);
    } else {
      // A real, visible coordinate stays valid at map edges and across the antimeridian.
      const group = singleMarker(entry);
      groups.push(group);
      const key = `${column}:${row}`;
      const anchors = cells.get(key) ?? [];
      anchors.push({ point, group });
      cells.set(key, anchors);
    }
  }

  return groups;
}
