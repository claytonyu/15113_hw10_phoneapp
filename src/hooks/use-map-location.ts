// Foreground location is active only while the map screen is in focus.
import * as Location from 'expo-location';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const MAX_PLACEMENT_AGE_MS = 5_000;
const MAX_PLACEMENT_ACCURACY_METERS = 50;
const FOLLOW_INTERVAL_MS = 1_000;
const FIRST_FIX_TIMEOUT_MS = 15_000;

/** Provides the permission state and a recent fix to snapshot when placing an entry. */
export function useMapLocation() {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');
  const [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [position, setPosition] = useState<Location.LocationObject | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const placementFix = useRef<Location.LocationObject | null>(null);
  const permissionConfirmed = useRef(false);
  const granted = permission?.granted === true;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!focused || !appActive) return;
    let active = true;
    Location.getForegroundPermissionsAsync().then(
      (result) => {
        if (!active) return;
        permissionConfirmed.current = result.granted;
        setPermission(result);
      },
      () => { if (active) setUnavailable(true); },
    );
    return () => {
      active = false;
      permissionConfirmed.current = false;
    };
  }, [focused, appActive]);

  useEffect(() => {
    if (!focused || !appActive || !granted) return;
    let active = true;
    let latestTimestamp = -Infinity;
    let subscription: Location.LocationSubscription | undefined;
    const firstFixTimeout = setTimeout(fail, FIRST_FIX_TIMEOUT_MS);

    /** Shares usable fixes across the map and placement controls. */
    function receive(fix: Location.LocationObject) {
      if (!active || fix.timestamp > Date.now()) return;
      const { accuracy } = fix.coords;
      if (accuracy !== null && accuracy >= 0 && accuracy <= MAX_PLACEMENT_ACCURACY_METERS
        && (!placementFix.current || fix.timestamp >= placementFix.current.timestamp)) {
        placementFix.current = fix;
      }
      if (fix.timestamp < latestTimestamp) return;
      latestTimestamp = fix.timestamp;
      clearTimeout(firstFixTimeout);
      setPosition(fix);
      setUnavailable(false);
    }

    /** Gives the user a retry action if the platform cannot supply a fix. */
    function fail() {
      if (!active) return;
      clearTimeout(firstFixTimeout);
      placementFix.current = null;
      setUnavailable(true);
    }

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 0, // Keep getting fresh fixes while standing still.
        timeInterval: FOLLOW_INTERVAL_MS,
      },
      receive,
      fail,
    ).then((watch) => {
      if (active) subscription = watch;
      else watch.remove();
    }).catch(fail);

    return () => {
      active = false;
      clearTimeout(firstFixTimeout);
      placementFix.current = null;
      subscription?.remove();
    };
  }, [focused, appActive, granted, attempt]);

  /** Requests access only after the user selects the location control. */
  async function requestLocation() {
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      permissionConfirmed.current = result.granted;
      setPermission(result);
      if (result.granted) setUnavailable(false);
      return result.granted;
    } catch {
      setUnavailable(true);
      return false;
    }
  }

  /** Freezes a sufficiently recent fix that was already available at the tap. */
  function snapshotLocation(tappedAt: number) {
    const fix = placementFix.current;
    if (!focused || !appActive || !granted || !permissionConfirmed.current || !fix) return null;
    const age = tappedAt - fix.timestamp;
    if (age < 0 || age > MAX_PLACEMENT_AGE_MS) return null;
    const { latitude, longitude } = fix.coords;
    return { latitude, longitude };
  }

  /** Gives a new watch time to find a fix before showing the retry state again. */
  function retryLocation() {
    placementFix.current = null;
    setPosition(null);
    setUnavailable(false);
    setAttempt((previous) => previous + 1);
  }

  return {
    permission, granted, position: granted ? position : null, unavailable,
    requestLocation, snapshotLocation, retryLocation,
  };
}
