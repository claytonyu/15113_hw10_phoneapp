// The map and journal target native phones for this prototype.
import { ScreenMessage } from '@/components/journal-ui';

/** Provides a useful landing message when the development URL opens in a browser. */
export default function FieldMap() {
  return <ScreenMessage message="Open this project in Expo Go on an iPhone or Android phone." />;
}
