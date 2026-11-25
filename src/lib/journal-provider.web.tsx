// Keeps native storage out of the browser's development preview.
import type { PropsWithChildren } from 'react';

import { JournalContext } from '@/lib/journal';

/** Blocks storage actions when the project is opened outside a supported phone. */
async function unavailable() {
  throw new Error('The Field Notes journal requires a phone.');
}

/** Provides the native-only preview with a stable unavailable journal. */
export function JournalProvider({ children }: PropsWithChildren) {
  return (
    <JournalContext value={{
      entries: [],
      status: 'error',
      retry: () => {},
      saveNote: unavailable,
      savePhoto: unavailable,
      deleteEntry: unavailable,
      beginDraft: () => {},
      draftCoordinates: null,
    }}>
      {children}
    </JournalContext>
  );
}
