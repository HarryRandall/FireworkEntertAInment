/** Lifecycle tasks expose visible failures and ignore completions from a closed editor. */
'use client';
import { useEffect, useRef, useState } from 'react';
/** Runs one lifecycle task, keeping successful document transitions locked until the route remounts. */
export function useStudioTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  function run(work: () => Promise<void>, transitioning = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    work().then(
      () => {
        if (active.current && !transitioning) setBusy(false);
      },
      (failure: unknown) => {
        console.error('Studio lifecycle failed', failure);
        if (active.current) {
          setError(
            failure instanceof Error
              ? failure.message
              : 'The operation failed. Your work is still here.',
          );
          setBusy(false);
        }
      },
    );
  }
  return { busy, error, run, isCurrent: () => active.current };
}
