'use client';

/**
 * Shared hover preview for firework browse cards.
 *
 * One fixed WebGL canvas follows the active card's media frame. Keeping the
 * canvas mounted avoids exhausting browser WebGL contexts while users scan a
 * dense catalogue, and the intent delay avoids loading previews for incidental
 * pointer movement.
 */
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
import {
  hydrateFireworkCardPreviewPayload,
  type FireworkCardPreviewPersistence,
  type FireworkCardPreviewPayload,
} from '@/lib/firework-card-preview';
import { estimateFireworkDesignTiming, isGroundFireworkEffect } from '@/lib/fireworks/timing';
import type { ReplayCue } from '@/lib/show-domain';

const HOVER_INTENT_MS = 500;
const MAX_STATIC_PREVIEW_SECONDS = 1.8;
// Posters are shown up to ~800 CSS px wide on wide grids, so 2x density needs
// ~1600 physical px; smaller captures leave the browser upscaling into mush.
// The background capture stage below is sized so a 2x display renders exactly
// these dimensions, avoiding any resample of the persisted frame.
const POSTER_WIDTH = 1600;
const POSTER_HEIGHT = 1000;
const POSTER_WEBP_QUALITY = 0.9;
const MAX_PREVIEW_CACHE_ENTRIES = 64;
const MAX_POSTER_CACHE_ENTRIES = 48;
const MAX_BACKGROUND_CAPTURE_ATTEMPTS = 2;
const BACKGROUND_CAPTURE_DELAY_MS = 350;
const SAME_PREVIEW_SEEK_EPSILON_SECONDS = 0.001;

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/components/replay/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => null },
);

type PreviewTarget = {
  id: string;
  previewUrl: string;
  element: HTMLElement;
  persist: boolean;
  background: boolean;
  displayPoster: boolean;
};

type PosterBackfillTarget = Pick<PreviewTarget, 'id' | 'previewUrl'> & {
  persist?: boolean;
  displayPoster?: boolean;
};

type LoadedPreview = {
  id: string;
  previewUrl: string;
  cues: ReplayCue[];
  durationSeconds: number;
  persistence: FireworkCardPreviewPersistence | null;
};

type CachedPreview = Pick<LoadedPreview, 'cues' | 'durationSeconds' | 'persistence'>;

type FireworkBrowsePreviewContextValue = {
  activeId: string | null;
  pendingId: string | null;
  readyId: string | null;
  failedId: string | null;
  posterUrls: ReadonlyMap<string, string>;
  requestPreview: (
    id: string,
    previewUrl: string,
    element: HTMLElement,
    options?: { immediate?: boolean; persist?: boolean },
  ) => void;
  releasePreview: (id: string) => void;
  togglePreview: (
    id: string,
    previewUrl: string,
    element: HTMLElement,
    options?: { persist?: boolean },
  ) => void;
  queuePosterCapture: (id: string, previewUrl: string, element: HTMLElement) => void;
  unqueuePosterCapture: (id: string) => void;
};

const FireworkBrowsePreviewContext = createContext<FireworkBrowsePreviewContextValue | null>(null);

// Successful payloads remain useful when a route swaps between tabs or pages
// without a full browser reload. Keep the cache bounded because an admin
// backfill can visit hundreds of designs in one session.
const previewCache = new Map<string, CachedPreview>();
const posterUrlCache = new Map<string, string>();
const posterBlobCache = new Map<string, Blob>();
const pendingPosterCaptures = new Map<string, Promise<boolean>>();
const persistedPosterCaptures = new Set<string>();

function cachePreview(previewUrl: string, preview: CachedPreview): void {
  previewCache.delete(previewUrl);
  previewCache.set(previewUrl, preview);

  while (previewCache.size > MAX_PREVIEW_CACHE_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (!oldestKey) break;
    previewCache.delete(oldestKey);
  }
}

function cachedPreview(previewUrl: string): CachedPreview | null {
  const preview = previewCache.get(previewUrl) ?? null;
  if (!preview) return null;
  previewCache.delete(previewUrl);
  previewCache.set(previewUrl, preview);
  return preview;
}

function previewDuration(value: number): number {
  return Number.isFinite(value) ? Math.max(1, value) : 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

type CueVisualWindow = {
  startSeconds: number;
  representativeSeconds: number;
  endSeconds: number;
};

function cueVisualWindow(cue: ReplayCue): CueVisualWindow {
  const design = cue.firework.renderDesign;
  if (!design) {
    return {
      startSeconds: cue.timeSeconds,
      representativeSeconds: cue.timeSeconds + MAX_STATIC_PREVIEW_SECONDS,
      endSeconds: cue.timeSeconds + MAX_STATIC_PREVIEW_SECONDS * 2,
    };
  }

  const timing = estimateFireworkDesignTiming(design);
  const hasVisibleBurstLayer = [design.stars.outer, design.stars.core].some(
    (layer) =>
      layer.enabled &&
      (layer.head.visible || (layer.burstTrail.enabled && layer.burstTrail.particlesPerStar > 0)),
  );
  if (!isGroundFireworkEffect(design) && timing.liftTimeSeconds > 0 && !hasVisibleBurstLayer) {
    const launchOffset = clamp(
      timing.liftTimeSeconds * 0.55,
      0.2,
      Math.max(0.2, timing.liftTimeSeconds * 0.85),
    );
    return {
      startSeconds: cue.timeSeconds,
      representativeSeconds: cue.timeSeconds + launchOffset,
      endSeconds: cue.timeSeconds + timing.liftTimeSeconds,
    };
  }

  const visibleDuration = Math.max(0.25, timing.fadeFinishSeconds - timing.effectStartSeconds);
  const developedOffset = isGroundFireworkEffect(design)
    ? clamp(visibleDuration * 0.38, 0.45, 4)
    : clamp(visibleDuration * 0.34, 0.35, 1.4);

  return {
    startSeconds: cue.timeSeconds + timing.effectStartSeconds,
    representativeSeconds: cue.timeSeconds + timing.effectStartSeconds + developedOffset,
    endSeconds: cue.timeSeconds + timing.fadeFinishSeconds,
  };
}

function staticPreviewTime(preview: CachedPreview): number {
  const windows = preview.cues.map(cueVisualWindow);
  if (windows.length === 0) return 0;

  const representative = windows.reduce((best, candidate) => {
    const candidateScore = windows.reduce(
      (score, window) =>
        score +
        (candidate.representativeSeconds >= window.startSeconds &&
        candidate.representativeSeconds <= window.endSeconds
          ? 1
          : 0),
      0,
    );
    const bestScore = windows.reduce(
      (score, window) =>
        score +
        (best.representativeSeconds >= window.startSeconds &&
        best.representativeSeconds <= window.endSeconds
          ? 1
          : 0),
      0,
    );
    if (candidateScore !== bestScore) return candidateScore > bestScore ? candidate : best;
    return candidate.representativeSeconds < best.representativeSeconds ? candidate : best;
  });

  return clamp(
    representative.representativeSeconds,
    0,
    Math.max(0, preview.durationSeconds - 0.05),
  );
}

function cachePosterUrl(previewUrl: string, posterUrl: string): void {
  const previous = posterUrlCache.get(previewUrl);
  if (previous && previous !== posterUrl) URL.revokeObjectURL(previous);
  posterUrlCache.delete(previewUrl);
  posterUrlCache.set(previewUrl, posterUrl);

  while (posterUrlCache.size > MAX_POSTER_CACHE_ENTRIES) {
    const oldestKey = posterUrlCache.keys().next().value;
    if (!oldestKey) break;
    const oldestUrl = posterUrlCache.get(oldestKey);
    posterUrlCache.delete(oldestKey);
    posterBlobCache.delete(oldestKey);
    if (oldestUrl) URL.revokeObjectURL(oldestUrl);
  }
}

function copyCanvasToPoster(source: HTMLCanvasElement): HTMLCanvasElement | null {
  if (source.width <= 0 || source.height <= 0) return null;
  const poster = document.createElement('canvas');
  poster.width = POSTER_WIDTH;
  poster.height = POSTER_HEIGHT;
  const context = poster.getContext('2d');
  if (!context) return null;

  const sourceRatio = source.width / source.height;
  const posterRatio = POSTER_WIDTH / POSTER_HEIGHT;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = source.width;
  let sourceHeight = source.height;
  if (sourceRatio > posterRatio) {
    sourceWidth = source.height * posterRatio;
    sourceX = (source.width - sourceWidth) / 2;
  } else if (sourceRatio < posterRatio) {
    sourceHeight = source.width / posterRatio;
    sourceY = (source.height - sourceHeight) / 2;
  }

  context.fillStyle = '#020409';
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    POSTER_WIDTH,
    POSTER_HEIGHT,
  );
  return poster;
}

function posterHasVisualDetail(poster: HTMLCanvasElement): boolean {
  const context = poster.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  const pixels = context.getImageData(0, 0, poster.width, poster.height).data;
  let highlightedSamples = 0;
  let darkest = 255;
  let brightest = 0;

  // The stage itself is deliberately dark. A developed firework contributes
  // enough bright or saturated samples to distinguish it from an empty frame.
  for (let index = 0; index < pixels.length; index += 4 * 16) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const high = Math.max(red, green, blue);
    const low = Math.min(red, green, blue);
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    darkest = Math.min(darkest, luminance);
    brightest = Math.max(brightest, luminance);
    if (high >= 96 && (high - low >= 22 || luminance >= 145)) highlightedSamples += 1;
  }
  return highlightedSamples >= 12 && brightest - darkest >= 55;
}

function posterBlob(poster: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    poster.toBlob(resolve, 'image/webp', POSTER_WEBP_QUALITY);
  });
}

async function persistPosterBlob(
  previewUrl: string,
  persistence: FireworkCardPreviewPersistence,
  blob: Blob,
): Promise<boolean> {
  try {
    const response = await fetch(previewUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'image/webp',
        'X-Firework-Preview-Kind': persistence.kind,
        'X-Firework-Preview-Source-Id': persistence.sourceId,
        'X-Firework-Preview-Source-Revision': String(persistence.sourceRevision),
        'X-Firework-Preview-Source-Signature': persistence.sourceSignature,
        'X-Firework-Preview-Expected-Path': persistence.expectedStoragePath ?? 'none',
        'X-Firework-Preview-Width': String(POSTER_WIDTH),
        'X-Firework-Preview-Height': String(POSTER_HEIGHT),
      },
      body: blob,
    });
    if (!response.ok) {
      throw new Error(`Poster persistence failed with ${response.status}`);
    }
    persistedPosterCaptures.add(previewUrl);
    return true;
  } catch (error) {
    console.error('[firework-browse-preview] poster persistence failed:', error);
    return false;
  }
}

export function useFireworkBrowsePreview() {
  return useContext(FireworkBrowsePreviewContext);
}

export function FireworkBrowsePreviewProvider({
  children,
  posterBackfillTargets,
}: {
  children: ReactNode;
  posterBackfillTargets?: readonly PosterBackfillTarget[];
}) {
  const [pending, setPending] = useState<PreviewTarget | null>(null);
  const [active, setActive] = useState<PreviewTarget | null>(null);
  const [mountedPreview, setMountedPreview] = useState<LoadedPreview | null>(null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [posterUrls, setPosterUrls] = useState<ReadonlyMap<string, string>>(
    () => new Map(posterUrlCache),
  );
  const [posterQueueVersion, setPosterQueueVersion] = useState(0);

  const pendingRef = useRef<PreviewTarget | null>(null);
  const activeRef = useRef<PreviewTarget | null>(null);
  const mountedPreviewRef = useRef<LoadedPreview | null>(null);
  const readyRef = useRef(false);
  const failedIdRef = useRef<string | null>(null);
  const reducedMotionRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const backgroundTargetRef = useRef<HTMLDivElement | null>(null);
  const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSerialRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const playbackRef = useRef(0);
  const readyFrameRef = useRef<number | null>(null);
  const captureFrameRef = useRef<number | null>(null);
  const providerMountedRef = useRef(true);
  const posterQueueRef = useRef(new Map<string, PreviewTarget>());
  const backgroundAttemptsRef = useRef(new Map<string, number>());

  const clearIntentTimer = useCallback(() => {
    if (intentTimerRef.current === null) return;
    clearTimeout(intentTimerRef.current);
    intentTimerRef.current = null;
  }, []);

  const clearReadyFrames = useCallback(() => {
    if (readyFrameRef.current !== null) cancelAnimationFrame(readyFrameRef.current);
    if (captureFrameRef.current !== null) cancelAnimationFrame(captureFrameRef.current);
    readyFrameRef.current = null;
    captureFrameRef.current = null;
  }, []);

  const parkOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.style.opacity = '0';
    overlay.style.transform = 'translate(-9999px, -9999px)';
    overlay.style.width = '0px';
    overlay.style.height = '0px';
    overlay.style.clipPath = 'inset(0 round 0.75rem)';
  }, []);

  const positionOverlay = useCallback((target: PreviewTarget) => {
    const overlay = overlayRef.current;
    if (!overlay || !target.element.isConnected) return false;
    const rect = target.element.getBoundingClientRect();
    const visibleLeft = Math.max(0, rect.left);
    const visibleTop = Math.max(0, rect.top);
    const visibleRight = Math.min(window.innerWidth, rect.right);
    const visibleBottom = Math.min(window.innerHeight, rect.bottom);
    const visible = visibleRight > visibleLeft && visibleBottom > visibleTop;

    overlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.clipPath = `inset(${visibleTop - rect.top}px ${rect.right - visibleRight}px ${rect.bottom - visibleBottom}px ${visibleLeft - rect.left}px round 0.75rem)`;
    return visible;
  }, []);

  const resetReady = useCallback(() => {
    readyRef.current = false;
    setReadyId(null);
    parkOverlay();
  }, [parkOverlay]);

  const setFailure = useCallback((id: string | null) => {
    failedIdRef.current = id;
    setFailedId(id);
  }, []);

  const queuePosterCapture = useCallback((id: string, previewUrl: string, element: HTMLElement) => {
    if (persistedPosterCaptures.has(previewUrl)) return;
    const current = posterQueueRef.current.get(id);
    if (current?.previewUrl === previewUrl && current.element === element) return;
    posterQueueRef.current.set(id, {
      id,
      previewUrl,
      element,
      persist: true,
      background: true,
      displayPoster: true,
    });
    setPosterQueueVersion((version) => version + 1);
  }, []);

  const unqueuePosterCapture = useCallback((id: string) => {
    if (!posterQueueRef.current.delete(id)) return;
    backgroundAttemptsRef.current.delete(id);
    setPosterQueueVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const element = backgroundTargetRef.current;
    if (!element) return;

    const targets = posterBackfillTargets ?? [];
    const targetIds = new Set(targets.map((target) => target.id));
    let changed = false;

    for (const [id, current] of posterQueueRef.current) {
      if (current.element !== element || targetIds.has(id)) continue;
      posterQueueRef.current.delete(id);
      backgroundAttemptsRef.current.delete(id);
      changed = true;
    }

    for (const target of targets) {
      const persist = target.persist ?? true;
      const displayPoster = target.displayPoster ?? false;
      const alreadyCaptured = persist
        ? persistedPosterCaptures.has(target.previewUrl)
        : displayPoster && posterUrlCache.has(target.previewUrl);
      if (alreadyCaptured) {
        const current = posterQueueRef.current.get(target.id);
        if (current?.element === element) {
          posterQueueRef.current.delete(target.id);
          backgroundAttemptsRef.current.delete(target.id);
          changed = true;
        }
        continue;
      }

      const current = posterQueueRef.current.get(target.id);
      if (
        current?.previewUrl === target.previewUrl &&
        current.element.isConnected &&
        current.persist === persist &&
        current.displayPoster === displayPoster
      ) {
        continue;
      }
      posterQueueRef.current.set(target.id, {
        id: target.id,
        previewUrl: target.previewUrl,
        element,
        persist,
        background: true,
        displayPoster,
      });
      changed = true;
    }

    if (changed) setPosterQueueVersion((version) => version + 1);
  }, [posterBackfillTargets]);

  const capturePoster = useCallback(
    (target: PreviewTarget, preview: CachedPreview): Promise<boolean> => {
      const pendingCapture = pendingPosterCaptures.get(target.previewUrl);
      if (pendingCapture) return pendingCapture;

      const task = (async () => {
        let blob = posterBlobCache.get(target.previewUrl) ?? null;
        if (!blob) {
          const source = overlayRef.current?.querySelector('canvas');
          if (!source) return false;
          const poster = copyCanvasToPoster(source);
          if (!poster || !posterHasVisualDetail(poster)) return false;
          blob = await posterBlob(poster);
          if (!blob) return false;

          if (target.displayPoster) {
            posterBlobCache.set(target.previewUrl, blob);
            cachePosterUrl(target.previewUrl, URL.createObjectURL(blob));
          }
        } else if (target.displayPoster) {
          const cachedUrl = posterUrlCache.get(target.previewUrl);
          if (cachedUrl) {
            posterUrlCache.delete(target.previewUrl);
            posterUrlCache.set(target.previewUrl, cachedUrl);
          }
        }

        if (target.displayPoster && providerMountedRef.current) {
          setPosterUrls(new Map(posterUrlCache));
        }
        if (!target.persist) return true;
        if (persistedPosterCaptures.has(target.previewUrl)) return true;
        if (!preview.persistence) return false;
        return persistPosterBlob(target.previewUrl, preview.persistence, blob);
      })().finally(() => {
        pendingPosterCaptures.delete(target.previewUrl);
      });

      pendingPosterCaptures.set(target.previewUrl, task);
      return task;
    },
    [],
  );

  const markPreviewReady = useCallback((target: PreviewTarget, serial: number) => {
    const current = activeRef.current;
    const mounted = mountedPreviewRef.current;
    if (
      requestSerialRef.current !== serial ||
      !current ||
      !mounted ||
      current.id !== target.id ||
      current.previewUrl !== target.previewUrl ||
      mounted.id !== target.id ||
      mounted.previewUrl !== target.previewUrl
    ) {
      return;
    }
    readyRef.current = true;
    setReadyId(target.id);
  }, []);

  const finishBackgroundCapture = useCallback(
    (target: PreviewTarget, serial: number, success: boolean) => {
      if (success) {
        posterQueueRef.current.delete(target.id);
        backgroundAttemptsRef.current.delete(target.id);
      } else {
        const attempts = (backgroundAttemptsRef.current.get(target.id) ?? 0) + 1;
        if (attempts >= MAX_BACKGROUND_CAPTURE_ATTEMPTS) {
          posterQueueRef.current.delete(target.id);
          backgroundAttemptsRef.current.delete(target.id);
        } else {
          backgroundAttemptsRef.current.set(target.id, attempts);
        }
      }
      setPosterQueueVersion((version) => version + 1);

      if (
        requestSerialRef.current !== serial ||
        activeRef.current?.id !== target.id ||
        !activeRef.current.background
      ) {
        return;
      }
      activeRef.current = null;
      setActive(null);
      playbackRef.current = 0;
      setFailure(null);
      resetReady();
    },
    [resetReady, setFailure],
  );

  const completePreviewFrame = useCallback(
    (target: PreviewTarget, preview: CachedPreview, serial: number) => {
      const capture = capturePoster(target, preview);
      if (target.background) {
        void capture.then((success) => finishBackgroundCapture(target, serial, success));
        return;
      }
      markPreviewReady(target, serial);
      void capture;
    },
    [capturePoster, finishBackgroundCapture, markPreviewReady],
  );

  const scheduleMountedCanvasReady = useCallback(
    (target: PreviewTarget, preview: CachedPreview, serial: number) => {
      clearReadyFrames();
      const posterTime = staticPreviewTime(preview);
      playbackRef.current = posterTime;
      readyFrameRef.current = requestAnimationFrame(() => {
        readyFrameRef.current = null;
        if (
          requestSerialRef.current !== serial ||
          activeRef.current?.id !== target.id ||
          activeRef.current.previewUrl !== target.previewUrl
        ) {
          return;
        }

        playbackRef.current = clamp(
          posterTime + SAME_PREVIEW_SEEK_EPSILON_SECONDS,
          0,
          Math.max(0, preview.durationSeconds - 0.025),
        );
        captureFrameRef.current = requestAnimationFrame(() => {
          captureFrameRef.current = null;
          if (
            requestSerialRef.current !== serial ||
            activeRef.current?.id !== target.id ||
            activeRef.current.previewUrl !== target.previewUrl
          ) {
            return;
          }
          completePreviewFrame(target, preview, serial);
        });
      });
    },
    [clearReadyFrames, completePreviewFrame],
  );

  const installPreview = useCallback((target: PreviewTarget, preview: CachedPreview) => {
    const next: LoadedPreview = { ...preview, id: target.id, previewUrl: target.previewUrl };
    playbackRef.current = staticPreviewTime(preview);
    mountedPreviewRef.current = next;
    setMountedPreview(next);
  }, []);

  const activatePreview = useCallback(
    async (target: PreviewTarget) => {
      clearIntentTimer();
      clearReadyFrames();
      pendingRef.current = null;
      setPending(null);

      const serial = ++requestSerialRef.current;
      abortRef.current?.abort();
      abortRef.current = null;
      activeRef.current = target;
      setActive(target);
      setFailure(null);
      resetReady();
      positionOverlay(target);

      const cached = cachedPreview(target.previewUrl);
      if (cached) {
        const canvasAlreadyMounted = mountedPreviewRef.current?.previewUrl === target.previewUrl;
        installPreview(target, cached);
        if (canvasAlreadyMounted) {
          scheduleMountedCanvasReady(target, cached, serial);
        }
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(target.previewUrl, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Preview request failed with ${response.status}`);

        const payload = (await response.json()) as FireworkCardPreviewPayload;
        const cues = hydrateFireworkCardPreviewPayload(payload);
        if (cues.length === 0) throw new Error('Preview contains no playable cues');

        const loaded: CachedPreview = {
          cues,
          durationSeconds: previewDuration(payload.durationSeconds),
          persistence: payload.persistence ?? null,
        };
        cachePreview(target.previewUrl, loaded);

        if (
          controller.signal.aborted ||
          requestSerialRef.current !== serial ||
          activeRef.current?.id !== target.id ||
          activeRef.current.previewUrl !== target.previewUrl
        ) {
          return;
        }
        positionOverlay(target);
        installPreview(target, loaded);
      } catch (error) {
        if (controller.signal.aborted || requestSerialRef.current !== serial) return;
        console.error('[firework-browse-preview] preview load failed:', error);
        resetReady();
        if (target.background) {
          finishBackgroundCapture(target, serial, false);
        } else {
          setFailure(target.id);
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [
      clearIntentTimer,
      clearReadyFrames,
      finishBackgroundCapture,
      installPreview,
      positionOverlay,
      resetReady,
      scheduleMountedCanvasReady,
      setFailure,
    ],
  );

  const requestPreview = useCallback(
    (
      id: string,
      previewUrl: string,
      element: HTMLElement,
      options?: { immediate?: boolean; persist?: boolean },
    ) => {
      clearIntentTimer();

      // Direct interaction always takes priority over sequential backfill.
      if (activeRef.current?.background) {
        clearReadyFrames();
        requestSerialRef.current += 1;
        abortRef.current?.abort();
        abortRef.current = null;
        activeRef.current = null;
        setActive(null);
        playbackRef.current = 0;
        resetReady();
      }

      const target: PreviewTarget = {
        id,
        previewUrl,
        element,
        persist: options?.persist ?? false,
        background: false,
        displayPoster: true,
      };

      if (
        activeRef.current?.id === id &&
        activeRef.current.previewUrl === previewUrl &&
        failedIdRef.current !== id
      ) {
        return;
      }

      pendingRef.current = target;
      setPending(target);
      setFailure(null);

      if (options?.immediate) {
        void activatePreview(target);
        return;
      }

      intentTimerRef.current = setTimeout(() => {
        intentTimerRef.current = null;
        void activatePreview(target);
      }, HOVER_INTENT_MS);
    },
    [activatePreview, clearIntentTimer, clearReadyFrames, resetReady, setFailure],
  );

  const releasePreview = useCallback(
    (id: string) => {
      const pendingMatches = pendingRef.current?.id === id;
      const activeMatches = activeRef.current?.id === id;
      if (!pendingMatches && !activeMatches) return;

      clearIntentTimer();
      clearReadyFrames();
      requestSerialRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;

      if (pendingMatches) {
        pendingRef.current = null;
        setPending(null);
      }
      if (activeMatches) {
        activeRef.current = null;
        setActive(null);
      }
      playbackRef.current = 0;
      setFailure(null);
      resetReady();
    },
    [clearIntentTimer, clearReadyFrames, resetReady, setFailure],
  );

  const togglePreview = useCallback(
    (id: string, previewUrl: string, element: HTMLElement, options?: { persist?: boolean }) => {
      const activeMatches = activeRef.current?.id === id;
      if (activeMatches && !activeRef.current?.background && failedIdRef.current !== id) {
        releasePreview(id);
        return;
      }
      requestPreview(id, previewUrl, element, { immediate: true, persist: options?.persist });
    },
    [releasePreview, requestPreview],
  );

  const cancelPreview = useCallback(() => {
    clearIntentTimer();
    clearReadyFrames();
    requestSerialRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    pendingRef.current = null;
    activeRef.current = null;
    setPending(null);
    setActive(null);
    playbackRef.current = 0;
    setFailure(null);
    resetReady();
  }, [clearIntentTimer, clearReadyFrames, resetReady, setFailure]);

  useEffect(() => {
    if (active || pending || posterQueueRef.current.size === 0) return;
    const timer = window.setTimeout(() => {
      let nextTarget: PreviewTarget | null = null;
      for (const [id, target] of posterQueueRef.current) {
        if (persistedPosterCaptures.has(target.previewUrl)) {
          posterQueueRef.current.delete(id);
          backgroundAttemptsRef.current.delete(id);
          continue;
        }
        if (!target.element.isConnected) {
          posterQueueRef.current.delete(id);
          backgroundAttemptsRef.current.delete(id);
          continue;
        }
        nextTarget = target;
        break;
      }
      if (!nextTarget) {
        setPosterQueueVersion((version) => version + 1);
        return;
      }
      void activatePreview(nextTarget);
    }, BACKGROUND_CAPTURE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, activatePreview, pending, posterQueueVersion]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedMotionRef.current = media.matches;
      setPrefersReducedMotion(media.matches);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (
      !active ||
      !mountedPreview ||
      active.id !== mountedPreview.id ||
      readyId !== mountedPreview.id
    ) {
      return;
    }

    if (prefersReducedMotion) {
      playbackRef.current = staticPreviewTime(mountedPreview);
      return;
    }

    const startSeconds = playbackRef.current;
    const startedAt = performance.now();
    let frameId = 0;
    const tick = (now: number) => {
      const duration = Math.max(1, mountedPreview.durationSeconds);
      playbackRef.current = (startSeconds + (now - startedAt) / 1000) % duration;
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active, mountedPreview, prefersReducedMotion, readyId]);

  useEffect(() => {
    if (!active && !pending) return;
    const options = { capture: true, passive: true } as const;
    window.addEventListener('wheel', cancelPreview, options);
    window.addEventListener('scroll', cancelPreview, options);
    window.addEventListener('touchmove', cancelPreview, options);
    return () => {
      window.removeEventListener('wheel', cancelPreview, options);
      window.removeEventListener('scroll', cancelPreview, options);
      window.removeEventListener('touchmove', cancelPreview, options);
    };
  }, [active, pending, cancelPreview]);

  useEffect(() => {
    if (!active) {
      parkOverlay();
      return;
    }

    let frameId = 0;
    const follow = () => {
      const overlay = overlayRef.current;
      if (!overlay || !active.element.isConnected) {
        parkOverlay();
        return;
      }

      const rect = active.element.getBoundingClientRect();
      const visibleLeft = Math.max(0, rect.left);
      const visibleTop = Math.max(0, rect.top);
      const visibleRight = Math.min(window.innerWidth, rect.right);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      const visible = visibleRight > visibleLeft && visibleBottom > visibleTop;
      const mountedMatches = mountedPreviewRef.current?.id === active.id;

      overlay.style.opacity =
        !active.background && visible && mountedMatches && readyRef.current ? '1' : '0';
      overlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.clipPath = `inset(${visibleTop - rect.top}px ${rect.right - visibleRight}px ${rect.bottom - visibleBottom}px ${visibleLeft - rect.left}px round 0.75rem)`;
      frameId = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frameId);
  }, [active, parkOverlay]);

  useEffect(() => {
    providerMountedRef.current = true;
    return () => {
      providerMountedRef.current = false;
      clearIntentTimer();
      clearReadyFrames();
      abortRef.current?.abort();
    };
  }, [clearIntentTimer, clearReadyFrames]);

  const handleCanvasReady = useCallback(() => {
    const current = activeRef.current;
    const mounted = mountedPreviewRef.current;
    if (
      !current ||
      !mounted ||
      current.id !== mounted.id ||
      current.previewUrl !== mounted.previewUrl
    ) {
      return;
    }

    clearReadyFrames();
    completePreviewFrame(current, mounted, requestSerialRef.current);
  }, [clearReadyFrames, completePreviewFrame]);

  const value = useMemo<FireworkBrowsePreviewContextValue>(
    () => ({
      activeId: active && !active.background ? active.id : null,
      pendingId: pending?.id ?? null,
      readyId,
      failedId,
      posterUrls,
      requestPreview,
      releasePreview,
      togglePreview,
      queuePosterCapture,
      unqueuePosterCapture,
    }),
    [
      active,
      pending?.id,
      readyId,
      failedId,
      posterUrls,
      requestPreview,
      releasePreview,
      togglePreview,
      queuePosterCapture,
      unqueuePosterCapture,
    ],
  );

  return (
    <FireworkBrowsePreviewContext.Provider value={value}>
      {children}
      <div
        ref={backgroundTargetRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 -z-50 h-[500px] w-[800px] opacity-0"
      />
      <div
        ref={overlayRef}
        aria-hidden
        className="bg-stage-night pointer-events-none fixed top-0 left-0 z-[70] overflow-hidden rounded-xl opacity-0"
        style={{ transform: 'translate(-9999px, -9999px)' }}
      >
        {mountedPreview ? (
          <LazyFireworkReplayCanvas
            cues={mountedPreview.cues}
            elapsed={0}
            playbackRef={playbackRef}
            interactive={false}
            allowWheelZoom={false}
            controlsVisible={false}
            showCameraControls={false}
            muted
            maxDevicePixelRatio={2}
            antialias
            showLoadingBar={false}
            onReady={handleCanvasReady}
          />
        ) : null}
      </div>
    </FireworkBrowsePreviewContext.Provider>
  );
}
