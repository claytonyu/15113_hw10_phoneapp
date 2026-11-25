// Uses a stable server snapshot while the browser hydrates the starter theme.
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

/** Subscribes to changes to the browser's preferred color scheme. */
function subscribe(onChange: () => void) {
  const subscription = Appearance.addChangeListener(onChange);
  return () => subscription.remove();
}

/** Returns light during server rendering and the browser preference afterward. */
export function useColorScheme() {
  return useSyncExternalStore(subscribe, Appearance.getColorScheme, () => 'light' as const);
}
