// The map camera follows foreground GPS until the user explores manually.
import { useNetworkState } from 'expo-network';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JournalButton, JournalUnavailable } from '@/components/journal-ui';
import { MapAction } from '@/components/map-controls';
import { colors, spacing } from '@/constants/field-notes-theme';
import { useMapLocation } from '@/hooks/use-map-location';
import type { Coordinates, Entry } from '@/lib/entries';
import { useJournal } from '@/lib/journal';
import { groupMapMarkers } from '@/lib/map-markers';

const WORLD_REGION: Region = { latitude: 20, longitude: 0, latitudeDelta: 115, longitudeDelta: 150 };
const FOLLOW_DELTA = 0.025;
const CAMERA_TRANSITION_MS = 250;

/** Opens the appropriate editor from either a marker or the creation controls. */
function openEntry(entry: Entry) {
  router.push({ pathname: entry.kind === 'note' ? '/note' : '/photo', params: { id: entry.id } });
}

/** Displays visible entries and captures a fixed placement before opening an editor. */
export default function FieldMap() {
  const { entries, status, beginDraft } = useJournal();
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const location = useMapLocation();
  const map = useRef<MapView>(null);
  const latestRegion = useRef(WORLD_REGION);
  const [region, setRegion] = useState(WORLD_REGION);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const [locating, setLocating] = useState(false);
  const placementInProgress = useRef(false);
  const followingPosition = following && location.position ? location.position.coords : null;
  const markerGroups = useMemo(() => groupMapMarkers(entries, region, size), [entries, region, size]);

  useEffect(() => {
    if (!ready || !followingPosition || offline) return;
    map.current?.animateToRegion({
      latitude: followingPosition.latitude, longitude: followingPosition.longitude,
      latitudeDelta: FOLLOW_DELTA, longitudeDelta: FOLLOW_DELTA,
    }, CAMERA_TRANSITION_MS);
  }, [followingPosition, offline, ready]);

  /** Requests access or restores the camera to the device location. */
  async function followLocation() {
    if (location.granted) {
      setFollowing(true);
      if (location.unavailable) location.retryLocation();
      return;
    }
    if (location.permission?.canAskAgain === false) {
      try {
        await Linking.openSettings();
      } catch {
        Alert.alert('Location settings unavailable', 'Open your phone settings to allow location access.');
      }
      return;
    }
    if (await location.requestLocation()) setFollowing(true);
  }

  /** Opens a fresh editor using the selected coordinates without putting them in a URL. */
  function compose(kind: Entry['kind'], coordinates: Coordinates | null) {
    beginDraft(coordinates);
    router.push(kind === 'note' ? '/note' : '/camera');
  }

  /** Uses the map center in browse mode and the latest device fix in follow mode. */
  async function placeFromToolbar(kind: Entry['kind']) {
    if (placementInProgress.current || status !== 'ready') return;
    if (offline) {
      compose(kind, null);
      return;
    }
    if (!following || !location.granted) {
      const { latitude, longitude } = latestRegion.current;
      compose(kind, ready ? { latitude, longitude } : null);
      return;
    }

    placementInProgress.current = true;
    setLocating(true);
    try {
      const coordinates = await location.snapshotLocation();
      if (coordinates) {
        compose(kind, coordinates);
      } else {
        Alert.alert('Location not available', 'Wait for the location dot, choose a point on the map, or save without a location.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue without location', onPress: () => compose(kind, null) },
        ]);
      }
    } finally {
      placementInProgress.current = false;
      setLocating(false);
    }
  }

  /** Offers both entry types at the point captured by the long press. */
  function chooseEntryKind(coordinates: Coordinates) {
    if (status !== 'ready' || placementInProgress.current) return;
    const placement = offline ? null : coordinates;
    Alert.alert('Add an entry', offline ? 'This entry will be saved without a location.' : 'Save an entry at this spot.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Note', onPress: () => compose('note', placement) },
      { text: 'Photo', onPress: () => compose('photo', placement) },
    ]);
  }

  /** Opens every entry in a cluster, even when several share identical coordinates. */
  function openGroup(group: (typeof markerGroups)[number]) {
    if (group.entries.length === 1) {
      openEntry(group.entries[0]);
      return;
    }
    router.push({ pathname: '/all-notes', params: { cluster: group.entries.map(({ id }) => id).join(',') } });
  }

  const followLabel = location.granted ? 'Follow me' : 'Use location';
  let mapStatus = 'Browse the map';
  if (location.granted && following) {
    mapStatus = location.position ? 'Following your location' : 'Finding your location…';
  }
  if (locating) mapStatus = 'Getting this entry’s location…';
  else if (location.unavailable) mapStatus = 'Location unavailable';
  if (offline) mapStatus = 'Offline · Map imagery may be unavailable';

  if (status !== 'ready') return <JournalUnavailable />;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.large, paddingVertical: 4 }}>
        <Text accessibilityLiveRegion="polite" style={{ flexShrink: 1, color: colors.muted, fontWeight: '600' }}>{mapStatus}</Text>
        <JournalButton label={followLabel} onPress={() => { void followLocation(); }} secondary />
      </View>
      <View
        onLayout={({ nativeEvent }) => setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })}
        style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.line }}
      >
        <MapView
          style={{ flex: 1 }}
          initialRegion={WORLD_REGION}
          showsUserLocation={location.granted}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={() => setReady(true)}
          onPanDrag={() => setFollowing(false)}
          onTouchStart={(event) => { if (event.nativeEvent.touches.length > 1) setFollowing(false); }}
          onDoublePress={() => setFollowing(false)}
          onRegionChangeStart={(_, details) => { if (details?.isGesture) setFollowing(false); }}
          onRegionChange={(next) => { latestRegion.current = next; }}
          onRegionChangeComplete={(next) => {
            latestRegion.current = next;
            setRegion(next);
          }}
          onLongPress={(event) => chooseEntryKind(event.nativeEvent.coordinate)}
        >
          {markerGroups.map((group) => {
            const entry = group.entries[0];
            const isCluster = group.entries.length > 1;
            return (
              <Marker
                key={group.key}
                coordinate={group.coordinates}
                pinColor={isCluster ? colors.ink : entry.kind === 'photo' ? colors.photo : colors.accentDark}
                title={isCluster ? `${group.entries.length} entries` : entry.kind === 'note' ? entry.title : 'Photo'}
                onPress={() => openGroup(group)}
              />
            );
          })}
        </MapView>
        {offline && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12, right: 12, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.medium }}>
            <Text style={{ color: colors.ink }}>New entries will be saved without a location.</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.small, padding: spacing.medium }}>
        <MapAction icon={{ ios: 'plus', android: 'add' }} label="Note" primary disabled={locating} onPress={() => { void placeFromToolbar('note'); }} />
        <MapAction icon={{ ios: 'camera', android: 'photo_camera' }} label="Photo" primary disabled={locating} onPress={() => { void placeFromToolbar('photo'); }} />
        <MapAction icon={{ ios: 'list.bullet', android: 'list' }} label="All Notes" disabled={locating} onPress={() => router.push('/all-notes')} />
      </View>
    </SafeAreaView>
  );
}
