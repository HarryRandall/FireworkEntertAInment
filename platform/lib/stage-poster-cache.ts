'use client';

/**
 * Session-wide cache for the empty firework-stage screenshot used as the hover
 * placeholder on browse cards. The heavy WebGL capture runs at most once per
 * browser: the resulting PNG data URL is memoised in-module and persisted to
 * localStorage so later sessions skip the capture entirely.
 */

const STORAGE_KEY = 'showcrafter:stage-poster:v1';

let posterPromise: Promise<string> | null = null;

/** Synchronous read of a persisted poster, or null if none / unavailable. */
export function getCachedStagePoster(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Resolve the stage poster, capturing it once if needed. Concurrent callers
 * share a single capture. Never rejects to the caller in a way that needs
 * handling beyond ignoring, callers should treat a rejection as "no image".
 */
export function getStagePoster(): Promise<string> {
  if (posterPromise) return posterPromise;

  posterPromise = (async () => {
    const cached = getCachedStagePoster();
    if (cached) return cached;

    const { renderStageToPng } = await import('@/lib/render-stage-poster');
    const png = await renderStageToPng();
    try {
      window.localStorage.setItem(STORAGE_KEY, png);
    } catch {
      // Storage full or unavailable; keep the in-memory result for this session.
    }
    return png;
  })();

  // Let a failed capture retry on a later hover instead of caching the rejection.
  posterPromise.catch(() => {
    posterPromise = null;
  });

  return posterPromise;
}
