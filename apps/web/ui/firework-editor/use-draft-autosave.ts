/** Debounced local autosave of the editor's unsaved fields, with a restore offer after a reload. */
'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  clearDraft,
  readDraft,
  writeDraft,
  type DraftSnapshot,
  type StoredDraft,
} from '@/lib/admin/draft-autosave';

const AUTOSAVE_DELAY_MS = 600; // UI tuning: coalesce typing without delaying the safety copy.

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Keeps a copy of unsaved edits on this device and clears it once the record is saved or reverted. */
export function useDraftAutosave<T extends DraftSnapshot>({
  storageKey,
  value,
  dirty,
  baseUpdatedAt,
  restore,
}: {
  storageKey: string;
  value: T;
  dirty: boolean;
  baseUpdatedAt: string;
  restore: (value: T) => void;
}) {
  const [recovered, setRecovered] = useState<StoredDraft<T> | null>(null);
  const [status, setStatus] = useState<'idle' | 'kept' | 'unavailable'>('idle');
  const checked = useRef(false);
  const latest = useRef({ value, baseUpdatedAt });
  useLayoutEffect(() => {
    latest.current = { value, baseUpdatedAt };
  }, [value, baseUpdatedAt]);

  // Offer a draft left by an earlier visit once, before this visit's autosave can replace it.
  useEffect(() => {
    checked.current = false;
    const stored = readDraft<T>(browserStorage(), storageKey, latest.current.value.id);
    setRecovered(
      stored && stored.value.signature !== latest.current.value.signature ? stored : null,
    );
    checked.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!checked.current || recovered) return;
    if (!dirty) {
      clearDraft(browserStorage(), storageKey);
      setStatus('idle');
      return;
    }
    const timer = window.setTimeout(() => {
      const ok = writeDraft(
        browserStorage(),
        storageKey,
        latest.current.value,
        latest.current.baseUpdatedAt,
      );
      setStatus(ok ? 'kept' : 'unavailable');
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [storageKey, dirty, value.signature, recovered]);

  return {
    status,
    recovered: recovered
      ? {
          savedAt: recovered.savedAt,
          stale: recovered.baseUpdatedAt !== baseUpdatedAt,
          restore: () => {
            restore(recovered.value);
            setRecovered(null);
          },
          discard: () => {
            clearDraft(browserStorage(), storageKey);
            setRecovered(null);
          },
        }
      : null,
  };
}
