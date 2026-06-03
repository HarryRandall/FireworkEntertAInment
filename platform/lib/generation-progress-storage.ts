const STORAGE_PREFIX = 'gen-show-startedAt:';

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
