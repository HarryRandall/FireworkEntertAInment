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
import { Play } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import type { ReplayCue } from '@/lib/show-domain';
import { SHOW_CARD_PREVIEW_WINDOW_SECONDS } from '@/lib/show-preview';
import type { ShowSummaryCard } from '@/lib/show-summary';

const HOVER_INTENT_MS = 500;

/**
 * Fetches the opening card-preview cues via a plain GET route handler rather
 * than a server action: in-flight actions are serialised with navigations, so
 * an action here made clicking a card mid-load feel stuck. A route-handler
 * fetch never blocks the click.
 */
async function getShowReplayPreviewCues(showId: string): Promise<ReplayCue[]> {
  const response = await fetch(
    `/api/shows/${encodeURIComponent(showId)}/replay-cues?window=${SHOW_CARD_PREVIEW_WINDOW_SECONDS}`,
    { credentials: 'same-origin', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error(`replay-cues responded ${response.status}`);
  const payload = (await response.json()) as { cues?: ReplayCue[] };
  return payload.cues ?? [];
}

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

function formatEditedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
  const previewStart = 0;
  const previewEnd = SHOW_CARD_PREVIEW_WINDOW_SECONDS;
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
      showLoadingBar={false}
      onReady={onReady}
    />
  );
}

export function ShowReplayPreviewProvider({ children }: { children: ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion();
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

  useEffect(() => {
    if (!prefersReducedMotion) return;
    cancelActivePreview();
  }, [cancelActivePreview, prefersReducedMotion]);

  const confirmPreview = useCallback(
    async (serial: number, id: string, element: HTMLElement, show: ShowSummaryCard) => {
      let cues = cueCacheRef.current.get(show.id);
      if (!cues) {
        try {
          cues = await getShowReplayPreviewCues(show.id);
          cueCacheRef.current.set(show.id, cues);
        } catch (error) {
          console.error('[show-replay] cue fetch failed', error);
          if (requestSerialRef.current !== serial) return;
          setPending((current) => (current && current.id === id ? null : current));
          setActive(null);
          parkOverlay();
          return;
        }
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
      if (prefersReducedMotion) return;

      requestSerialRef.current += 1;
      const serial = requestSerialRef.current;
      clearIntentTimer();
      setPending({ id, element });
      intentTimerRef.current = setTimeout(() => {
        intentTimerRef.current = null;
        void confirmPreview(serial, id, element, show);
      }, HOVER_INTENT_MS);
    },
    [clearIntentTimer, confirmPreview, prefersReducedMotion],
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

    // Scroll-like movement cancels the preview above. Remeasure only when the
    // card or viewport resizes so overlay tracking does not force layout each frame.
    let frame = 0;
    const positionOverlay = () => {
      frame = 0;
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
        return;
      }

      overlay.style.opacity = readyRef.current ? '1' : '0';
      overlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.clipPath = 'inset(0 round 0.75rem)';
    };

    const schedulePosition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(positionOverlay);
    };

    schedulePosition();
    window.addEventListener('resize', schedulePosition);
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePosition);
    resizeObserver?.observe(active.element);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedulePosition);
      resizeObserver?.disconnect();
    };
  }, [active, parkOverlay, ready]);

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
        {mountedPreview && !prefersReducedMotion ? (
          <>
            <ShowReplayPreviewSurface
              preview={mountedPreview}
              active={active !== null}
              onReady={() => {
                readyRef.current = true;
                setReady(true);
              }}
            />
            <span className="pointer-events-none absolute top-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
              <Play size={16} fill="currentColor" />
            </span>
            <span className="pointer-events-none absolute top-2 right-2 z-20 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] font-medium text-white/90 tabular-nums">
              {formatEditedAt(mountedPreview.show.lastEditedAt)}
            </span>
          </>
        ) : null}
      </div>
    </ShowReplayPreviewContext.Provider>
  );
}
