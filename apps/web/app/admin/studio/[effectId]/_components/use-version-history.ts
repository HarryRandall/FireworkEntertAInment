/** Opening history first acknowledges current work, then reads up-to-date saved snapshots. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { readStudioHistory } from '@/lib/studio/history-actions';
import type { loadStudioHistory } from '@/lib/studio/history-load';
/** Keeps history reads distinct from editing and preserves current work after a read failure. */
export function useVersionHistory(
  effectId: string,
  initial: Awaited<ReturnType<typeof loadStudioHistory>>,
  settle: () => Promise<string | null>,
) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  async function read() {
    setBusy(true);
    setError('');
    try {
      const id = await settle();
      const latest = await readStudioHistory(effectId);
      if (!active.current) return;
      setCurrentId(id);
      setData(latest);
      setOpen(true);
    } catch (failure) {
      console.error('Studio history read failed', failure);
      if (active.current)
        setError('Version history could not be loaded. Your current work is still here.');
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return {
    data,
    open,
    setOpen,
    error,
    busy,
    currentId,
    show: () => {
      read().catch((failure: unknown) => {
        console.error('History coordination failed', failure);
      });
    },
  };
}
