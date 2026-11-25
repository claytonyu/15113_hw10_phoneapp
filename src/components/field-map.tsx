// The map camera follows foreground GPS until the user explores manually.
import { useNetworkState } from 'expo-network';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JournalButton, JournalUnavailable } from '@/components/journal-ui';
import { MapAction } from '@/components/map-controls';
import { colors, spacing } from '@/constants/field-notes-theme';
import { useMapLocation } from '@/hooks/use-map-location';
import { useMapMarkers } from '@/hooks/use-map-markers';
import type { Coordinates, Entry } from '@/lib/entries';
import { useJournal } from '@/lib/journal';
import type { MarkerGroup } from '@/lib/map-markers';

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
  const mapMoving = useRef(false);
  const manuallyExploring = useRef(false);
  const selectedCenter = useRef<Coordinates | null>(null);
  const viewportVersion = useRef(0);
  const [settledViewport, setSettledViewport] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const followLatitude = following ? location.position?.coords.latitude : undefined;
  const followLongitude = following ? location.position?.coords.longitude : undefined;
  const markerGroups = useMapMarkers(map, entries, size, ready && status === 'ready', settledViewport, viewportVersion);

  useEffect(() => {
    if (!ready || manuallyExploring.current || followLatitude === undefined || followLongitude === undefined) return;
    const view = map.current;
    if (!view) return;
    view.animateToRegion({
      latitude: followLatitude, longitude: followLongitude,
      latitudeDelta: FOLLOW_DELTA, longitudeDelta: FOLLOW_DELTA,
    }, CAMERA_TRANSITION_MS);
  }, [followLatitude, followLongitude, ready]);

  /** Switches to manual placement as soon as a gesture starts. */
  function browseMap() {
    manuallyExploring.current = true;
    setFollowing(false);
  }

  /** Clears manual placement when the user asks to follow their location again. */
  function resumeFollowing() {
    manuallyExploring.current = false;
    selectedCenter.current = null;
    setFollowing(true);
  }

  /** Publishes the viewport used for clustering after layout or camera movement. */
  function settleViewport() {
    mapMoving.current = false;
    viewportVersion.current += 1;
    setSettledViewport(viewportVersion.current);
  }

  /** Requests access or restores the camera to the device location. */
  async function followLocation() {
    if (location.granted) {
      resumeFollowing();
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
    if (await location.requestLocation()) resumeFollowing();
  }

  /** Opens a fresh editor using the selected coordinates without putting them in a URL. */
  function compose(kind: Entry['kind'], coordinates: Coordinates | null) {
    beginDraft(coordinates);
    router.push(kind === 'note' ? '/note' : '/camera');
  }

  /** Freezes the selected center or a recent GPS fix at the toolbar tap. */
  function placeFromToolbar(kind: Entry['kind']) {
    const tappedAt = Date.now();
    if (status !== 'ready') return;
    if (offline) {
      compose(kind, null);
      return;
    }
    const manual = manuallyExploring.current;
    const center = ready ? selectedCenter.current : null;
    const coordinates = manual ? center : location.snapshotLocation(tappedAt);
    if (coordinates) {
      compose(kind, coordinates);
      return;
    }

    let guidance = 'Move the map to choose a center, or press and hold a spot.';
    if (!ready) guidance = 'Wait for the map to load, or continue without a location.';
    else if (!manual && location.granted) guidance = 'Try again when a recent GPS fix is available, or choose a spot on the map.';
    else if (!manual) guidance = 'Tap Use location for GPS, or move the map to choose a spot.';

    Alert.alert('Location not available', guidance, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue without location', onPress: () => compose(kind, null) },
    ]);
  }

  /** Offers both entry types at the point captured by the long press. */
  function chooseEntryKind(coordinates: Coordinates) {
    if (status !== 'ready' || !ready) return;
    const placement = offline ? null : coordinates;
    Alert.alert('Add an entry', offline ? 'This entry will be saved without a location.' : 'Save an entry at this spot.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Note', onPress: () => compose('note', placement) },
      { text: 'Photo', onPress: () => compose('photo', placement) },
    ]);
  }

  /** Opens every entry in a cluster, even when several share identical coordinates. */
  function openGroup(group: MarkerGroup) {
    if (group.entries.length === 1) {
      openEntry(group.entries[0]);
      return;
    }
    router.push({ pathname: '/all-notes', params: { cluster: group.entries.map(({ id }) => id).join(',') } });
  }

  const followLabel = location.granted ? 'Follow me' : 'Use location';
  let mapStatus = 'Move the map to choose a location';
  if (location.granted && following) {
    if (location.unavailable) mapStatus = 'Location unavailable';
    else mapStatus = location.position ? 'Following your location' : 'Finding your location…';
  }
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
          ref={map}
          style={{ flex: 1 }}
          initialRegion={WORLD_REGION}
          showsUserLocation={location.granted}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={() => {
            setReady(true);
            settleViewport();
          }}
          onPanDrag={browseMap}
          onTouchStart={(event) => { if (event.nativeEvent.touches.length > 1) browseMap(); }}
          onDoublePress={browseMap}
          onRegionChangeStart={(_, details) => {
            mapMoving.current = true;
            viewportVersion.current += 1;
            if (details?.isGesture) browseMap();
            if (manuallyExploring.current) selectedCenter.current = null;
          }}
          onRegionChange={({ latitude, longitude }, details) => {
            if (!mapMoving.current) viewportVersion.current += 1;
            mapMoving.current = true;
            if (details?.isGesture) browseMap();
            if (manuallyExploring.current) selectedCenter.current = { latitude, longitude };
          }}
          onRegionChangeComplete={({ latitude, longitude }, details) => {
            if (details?.isGesture) browseMap();
            if (manuallyExploring.current) selectedCenter.current = { latitude, longitude };
            settleViewport();
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
        <MapAction icon={{ ios: 'plus', android: 'add' }} label="Note" primary onPress={() => placeFromToolbar('note')} />
        <MapAction icon={{ ios: 'camera', android: 'photo_camera' }} label="Photo" primary onPress={() => placeFromToolbar('photo')} />
        <MapAction icon={{ ios: 'list.bullet', android: 'list' }} label="All Notes" onPress={() => router.push('/all-notes')} />
      </View>
    </SafeAreaView>
  );
}
