// Uses the displayed map's projection on both iOS and Android.
import { useEffect, useState, type RefObject } from 'react';
import type MapView from 'react-native-maps';
import type { Point } from 'react-native-maps';

import type { Entry } from '@/lib/entries';
import { groupMapMarkers, singleMarker, type LocatedEntry, type MarkerGroup } from '@/lib/map-markers';

const PROJECTION_BATCH_SIZE = 32;

/** Refreshes visible markers once the camera settles and ignores outdated projections. */
export function useMapMarkers(
  map: RefObject<MapView | null>,
  entries: Entry[],
  size: { width: number; height: number },
  ready: boolean,
  settledViewport: number,
  viewportVersion: RefObject<number>,
) {
  const [groups, setGroups] = useState<MarkerGroup[]>([]);

  useEffect(() => {
    const view = map.current;
    if (!view || !ready || !size.width || !size.height || settledViewport !== viewportVersion.current) return;
    let active = true;

    /** Stops pending projection work when either the data or the viewport changes. */
    function isCurrent() {
      return active && settledViewport === viewportVersion.current && view === map.current;
    }

    /** Projects in batches to limit simultaneous native requests. */
    async function refresh(mapView: MapView) {
      const located = entries.filter((entry): entry is LocatedEntry => entry.coordinates !== null);
      const projected: { entry: LocatedEntry; point: Point }[] = [];
      const unprojected: MarkerGroup[] = [];

      for (let offset = 0; offset < located.length; offset += PROJECTION_BATCH_SIZE) {
        if (!isCurrent()) return;
        const batch = located.slice(offset, offset + PROJECTION_BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(async (entry) => ({
          entry, point: await mapView.pointForCoordinate(entry.coordinates),
        })));
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') projected.push(result.value);
          else unprojected.push(singleMarker(batch[index]));
        });
      }

      // If a conversion fails, let the map handle that pin's visibility itself.
      if (isCurrent()) setGroups([...groupMapMarkers(projected, size), ...unprojected]);
    }

    void refresh(view);
    return () => { active = false; };
  }, [entries, map, ready, settledViewport, size, viewportVersion]);

  return groups;
}
