import { parseCover, randomCover, type ShowCover } from '@/lib/cover';

const STORAGE_PREFIX = 'gen-show-startedAt:';
const COVER_PREFIX = 'gen-show-cover:';

/**
 * Session-scoped random cover for a generating show, keyed by slug. Lets the
 * wizard's instant launch overlay and the /generating route splash share the
 * exact same backdrop so the handoff between them is invisible.
 */
export function resolvePersistedGenerationCover(persistKey: string | undefined): ShowCover {
  if (!persistKey || typeof window === 'undefined') return randomCover();
  try {
    const raw = window.sessionStorage.getItem(COVER_PREFIX + persistKey);
    if (raw) {
      const parsed = parseCover(JSON.parse(raw));
      if (parsed) return parsed;
    }
    const cover = randomCover();
    window.sessionStorage.setItem(COVER_PREFIX + persistKey, JSON.stringify(cover));
    return cover;
  } catch {
    return randomCover();
  }
}

/** Read the persisted cover without creating one when it is absent. */
export function peekPersistedGenerationCover(persistKey: string | undefined): ShowCover | null {
  if (!persistKey || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(COVER_PREFIX + persistKey);
    return raw ? parseCover(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Move a persisted cover to a new key (slug collision → server-suffixed slug). */
export function copyPersistedGenerationCover(
  fromKey: string | undefined,
  toKey: string | undefined,
): void {
  if (!fromKey || !toKey || typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(COVER_PREFIX + fromKey);
    if (raw) window.sessionStorage.setItem(COVER_PREFIX + toKey, raw);
  } catch {
    // Ignore unavailable sessionStorage.
  }
}

export function clearPersistedGenerationCover(persistKey: string | undefined): void {
  if (!persistKey || typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(COVER_PREFIX + persistKey);
  } catch {
    // Ignore unavailable sessionStorage.
  }
}

export function persistGenerationStartedAt(
  persistKey: string | undefined,
  startedAt = Date.now(),
): number {
  if (!persistKey || typeof window === 'undefined') return startedAt;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + persistKey, String(startedAt));
  } catch {
    // Ignore unavailable sessionStorage.
  }
  return startedAt;
}

export function resolveGenerationStartedAt(
  persistKey: string | undefined,
  fallbackStartedAt = Date.now(),
): number {
  if (!persistKey || typeof window === 'undefined') return fallbackStartedAt;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + persistKey);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return persistGenerationStartedAt(persistKey, fallbackStartedAt);
  } catch {
    return fallbackStartedAt;
  }
}

export function clearPersistedGenerationStart(persistKey: string | undefined): void {
  if (!persistKey || typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_PREFIX + persistKey);
  } catch {
    // Ignore unavailable sessionStorage.
  }
}
