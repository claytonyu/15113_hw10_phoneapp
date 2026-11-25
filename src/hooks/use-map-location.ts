// Foreground location is active only while the map screen is in focus.
import * as Location from 'expo-location';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const MAX_LOCATION_AGE_MS = 30_000;
const LOCATION_WAIT_MS = 4_000;
const MOVEMENT_INTERVAL_METERS = 8;

/** Provides the permission state and a recent fix to snapshot when placing an entry. */
export function useMapLocation() {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');
  const [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [position, setPosition] = useState<Location.LocationObject | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lastFix = useRef<Location.LocationObject | null>(null);
  const granted = permission?.granted === true;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!focused || !appActive) return;
    let active = true;
    Location.getForegroundPermissionsAsync().then(
      (result) => { if (active) setPermission(result); },
      () => { if (active) setUnavailable(true); },
    );
    return () => { active = false; };
  }, [focused, appActive]);

  useEffect(() => {
    if (!focused || !appActive || !granted) return;
    let active = true;
    let subscription: Location.LocationSubscription | undefined;

    /** Shares usable fixes across the map and placement controls. */
    function receive(fix: Location.LocationObject) {
      if (!active || (lastFix.current && fix.timestamp < lastFix.current.timestamp)) return;
      lastFix.current = fix;
      setPosition(fix);
      setUnavailable(false);
    }

    /** Gives the user a retry action if the platform cannot supply a fix. */
    function fail() {
      if (active) setUnavailable(true);
    }

    Location.getLastKnownPositionAsync({ maxAge: MAX_LOCATION_AGE_MS }).then((fix) => {
      if (fix) receive(fix);
    }).catch(() => {});
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: MOVEMENT_INTERVAL_METERS },
      receive,
      fail,
    ).then((watch) => {
      if (active) subscription = watch;
      else watch.remove();
    }).catch(fail);

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [focused, appActive, granted, attempt]);

  /** Requests access only after the user selects the location control. */
  async function requestLocation() {
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      setPermission(result);
      if (result.granted) setUnavailable(false);
      return result.granted;
    } catch {
      setUnavailable(true);
      return false;
    }
  }

  /** Uses a recent fix or starts a short location request when the user taps. */
  async function snapshotLocation() {
    const last = lastFix.current;
    if (last && Date.now() - last.timestamp <= MAX_LOCATION_AGE_MS) {
      return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), LOCATION_WAIT_MS);
      });
      const fix = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false }),
        deadline,
      ]);
      return fix ? { latitude: fix.coords.latitude, longitude: fix.coords.longitude } : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    permission, granted, position: granted ? position : null, unavailable,
    requestLocation, snapshotLocation,
    retryLocation: () => setAttempt((previous) => previous + 1),
  };
}
