'use client';

import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getShowReplayCues } from '@/app/actions/show-replay-cues';
import type { ReplayCue } from '@/lib/show-domain';
import type { ShowSummaryCard } from '@/lib/show-summary';

const HOVER_INTENT_MS = 500;
const CARD_PREVIEW_WINDOW_SECONDS = 18;

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => null },
);

type PreviewContextValue = {
  activeId: string | null;
  pendingId: string | null;
  readyId: string | null;
  requestPreview: (id: string, element: HTMLElement, show: ShowSummaryCard) => void;
  releasePreview: (id: string) => void;
};

type ActivePreview = {
  id: string;
  element: HTMLElement;
};

type MountedPreview = {
  show: ShowSummaryCard;
  cues: ReplayCue[];
};

const ShowReplayPreviewContext = createContext<PreviewContextValue | null>(null);

export function useShowReplayPreview() {
  return useContext(ShowReplayPreviewContext);
}

function previewStartFor(cues: ReplayCue[]) {
  const firstCue = cues[0]?.timeSeconds ?? 0;
  return Math.max(0, firstCue - 0.3);
}

function ShowReplayPreviewSurface({
  preview,
  active,
  onReady,
}: {
  preview: MountedPreview;
  active: boolean;
  onReady: () => void;
}) {
  const previewStart = useMemo(() => previewStartFor(preview.cues), [preview.cues]);
  const duration = Math.max(
    preview.show.lengthSeconds ?? 30,
    preview.cues.at(-1)?.timeSeconds ?? 0,
    10,
  );
  const previewEnd = Math.min(duration, previewStart + CARD_PREVIEW_WINDOW_SECONDS);
  const [elapsed, setElapsed] = useState(previewStart);
  const elapsedRef = useRef(previewStart);

  useEffect(() => {
    elapsedRef.current = previewStart;
    setElapsed(previewStart);
  }, [preview.show.id, previewStart]);

  useEffect(() => {
    if (!active || preview.cues.length === 0) return;

    let frame = 0;
    let startedAt = performance.now();
    let playheadStart = elapsedRef.current;

    function tick(now: number) {
      const next = playheadStart + (now - startedAt) / 1000;
      if (next >= previewEnd) {
        startedAt = now;
        playheadStart = previewStart;
        elapsedRef.current = previewStart;
        setElapsed(previewStart);
      } else {
        elapsedRef.current = next;
        setElapsed(next);
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, preview.cues.length, previewEnd, previewStart]);

  if (preview.cues.length === 0) return null;

  return (
    <LazyFireworkReplayCanvas
      cues={preview.cues}
      elapsed={elapsed}
      playbackRef={elapsedRef}
      interactive={false}
      muted
      maxDevicePixelRatio={1.75}
      antialias
      onReady={onReady}
    />
  );
}

export function ShowReplayPreviewProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActivePreview | null>(null);
  const [pending, setPending] = useState<{ id: string; element: HTMLElement } | null>(null);
  const [mountedPreview, setMountedPreview] = useState<MountedPreview | null>(null);
  const [ready, setReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const readyRef = useRef(false);
  const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSerialRef = useRef(0);
  const cueCacheRef = useRef<Map<string, ReplayCue[]>>(new Map());

  useEffect(() => {
    readyRef.current = false;
    setReady(false);
  }, [active?.id, mountedPreview?.show.id]);

  const clearIntentTimer = useCallback(() => {
    if (intentTimerRef.current !== null) {
      clearTimeout(intentTimerRef.current);
      intentTimerRef.current = null;
    }
  }, []);

  const parkOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.transform = 'translate(-9999px, -9999px)';
    overlay.style.width = '0px';
    overlay.style.height = '0px';
    overlay.style.clipPath = 'inset(0 round 0.75rem)';
  }, []);

  const cancelActivePreview = useCallback(() => {
    requestSerialRef.current += 1;
    clearIntentTimer();
    setPending(null);
    setActive(null);
    parkOverlay();
  }, [clearIntentTimer, parkOverlay]);

  const confirmPreview = useCallback(
    async (serial: number, id: string, element: HTMLElement, show: ShowSummaryCard) => {
      let cues = cueCacheRef.current.get(show.id);
      if (!cues) {
        try {
          cues = await getShowReplayCues(show.id);
        } catch (error) {
          console.error('[show-replay] cue fetch failed', error);
          cues = [];
        }
        cueCacheRef.current.set(show.id, cues);
      }

      if (requestSerialRef.current !== serial) return;
      setPending((current) => (current && current.id === id ? null : current));

      if (cues.length === 0) {
        setActive(null);
        parkOverlay();
        return;
      }

      setMountedPreview({ show, cues });
      setActive({ id, element });
    },
    [parkOverlay],
  );

  const requestPreview = useCallback(
    (id: string, element: HTMLElement, show: ShowSummaryCard) => {
      requestSerialRef.current += 1;
      const serial = requestSerialRef.current;
      clearIntentTimer();
      setPending({ id, element });
      intentTimerRef.current = setTimeout(() => {
        intentTimerRef.current = null;
        void confirmPreview(serial, id, element, show);
      }, HOVER_INTENT_MS);
    },
    [clearIntentTimer, confirmPreview],
  );

  const releasePreview = useCallback(
    (id: string) => {
      requestSerialRef.current += 1;
      clearIntentTimer();
      setPending((current) => (current && current.id === id ? null : current));
      setActive((current) => (current && current.id === id ? null : current));
    },
    [clearIntentTimer],
  );

  useEffect(() => () => clearIntentTimer(), [clearIntentTimer]);

  useEffect(() => {
    if (!active && !pending) return;

    const options = { capture: true, passive: true } as const;
    window.addEventListener('wheel', cancelActivePreview, options);
    window.addEventListener('scroll', cancelActivePreview, options);
    window.addEventListener('touchmove', cancelActivePreview, options);
    return () => {
      window.removeEventListener('wheel', cancelActivePreview, options);
      window.removeEventListener('scroll', cancelActivePreview, options);
      window.removeEventListener('touchmove', cancelActivePreview, options);
    };
  }, [active, pending, cancelActivePreview]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    if (!active) {
      parkOverlay();
      return;
    }

    let raf = 0;
    const follow = () => {
      if (!active.element.isConnected) {
        parkOverlay();
        return;
      }

      const rect = active.element.getBoundingClientRect();
      if (
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth
      ) {
        overlay.style.opacity = '0';
        raf = requestAnimationFrame(follow);
        return;
      }

      overlay.style.opacity = readyRef.current ? '1' : '0';
      overlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.clipPath = 'inset(0 round 0.75rem)';
      raf = requestAnimationFrame(follow);
    };

    follow();
    return () => cancelAnimationFrame(raf);
  }, [active, parkOverlay]);

  return (
    <ShowReplayPreviewContext.Provider
      value={useMemo(
        () => ({
          activeId: active?.id ?? null,
          pendingId: pending?.id ?? null,
          readyId: ready ? (active?.id ?? null) : null,
          requestPreview,
          releasePreview,
        }),
        [active?.id, pending?.id, ready, requestPreview, releasePreview],
      )}
    >
      {children}
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-30 overflow-hidden rounded-xl opacity-0"
        style={{ transform: 'translate(-9999px, -9999px)' }}
      >
        {mountedPreview ? (
          <ShowReplayPreviewSurface
            preview={mountedPreview}
            active={active !== null}
            onReady={() => {
              readyRef.current = true;
              setReady(true);
            }}
          />
        ) : null}
      </div>
    </ShowReplayPreviewContext.Provider>
  );
}
