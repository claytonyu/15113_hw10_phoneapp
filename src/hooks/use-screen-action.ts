// Prevents duplicate saves and avoids navigating after an in-flight screen closes.
import { useEffect, useRef, useState } from 'react';

/** Runs one action at a time and makes recoverable errors visible to the user. */
export function useScreenAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /** Runs the action and invokes its success handler only while the screen is open. */
  async function run(action: () => Promise<void>, failure: string, done?: () => void) {
    if (!mounted.current || running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      if (mounted.current) done?.();
    } catch {
      if (mounted.current) setError(failure);
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
