/**
 * Short-lived analyser warm-up controls.
 *
 * The warm window is stored in the shared cache when Upstash is configured.
 * Without Upstash it still works while the same server process is alive, but
 * separate serverless invocations may not share the same in-memory state.
 */
import 'server-only';

import { deleteCachedKeys, getCachedJson, hasRedisCache, setCachedJson } from '@/lib/server-cache';

const ANALYSER_WARMTH_CACHE_KEY = 'platform:v1:analyser:warmth';
const WARM_WINDOW_MS = 30 * 60 * 1000;
const CACHE_BUFFER_SECONDS = 90;
const WARMUP_MIN_INTERVAL_MS = 30 * 1000;
const WARMUP_TIMEOUT_MS = 25 * 1000;

type StoredAnalyserWarmthState = {
  warmUntil: string;
  enabledAt: string;
  enabledBy: string;
  lastWarmupAt?: string | null;
  lastWarmupOk?: boolean | null;
  lastWarmupError?: string | null;
};

export type AnalyserWarmthState = {
  active: boolean;
  warmUntil: string | null;
  enabledAt: string | null;
  lastWarmupAt: string | null;
  lastWarmupOk: boolean | null;
  lastWarmupError: string | null;
  cacheMode: 'shared' | 'memory';
};

export type AnalyserWarmthRefreshResult =
  | { ok: true; active: false; skipped: 'inactive'; state: AnalyserWarmthState }
  | { ok: true; active: true; skipped: 'recent'; state: AnalyserWarmthState }
  | { ok: true; active: true; warmed: true; state: AnalyserWarmthState }
  | { ok: false; active: true; error: string; state: AnalyserWarmthState };

export type AnalyserWarmthPingResult =
  | { ok: true; warmedAt: string }
  | { ok: false; warmedAt: string; error: string };

function cacheMode(): 'shared' | 'memory' {
  return hasRedisCache() ? 'shared' : 'memory';
}

function inactiveState(): AnalyserWarmthState {
  return {
    active: false,
    warmUntil: null,
    enabledAt: null,
    lastWarmupAt: null,
    lastWarmupOk: null,
    lastWarmupError: null,
    cacheMode: cacheMode(),
  };
}

function toPublicState(stored: StoredAnalyserWarmthState): AnalyserWarmthState {
  const warmUntilMs = Date.parse(stored.warmUntil);
  if (!Number.isFinite(warmUntilMs) || warmUntilMs <= Date.now()) return inactiveState();

  return {
    active: true,
    warmUntil: stored.warmUntil,
    enabledAt: stored.enabledAt,
    lastWarmupAt: stored.lastWarmupAt ?? null,
    lastWarmupOk: stored.lastWarmupOk ?? null,
    lastWarmupError: stored.lastWarmupError ?? null,
    cacheMode: cacheMode(),
  };
}

function ttlForWarmUntil(warmUntil: string): number {
  const remainingMs = Math.max(Date.parse(warmUntil) - Date.now(), 0);
  return Math.max(Math.ceil(remainingMs / 1000) + CACHE_BUFFER_SECONDS, CACHE_BUFFER_SECONDS);
}

function truncateError(value: string): string {
  return value.length <= 320 ? value : `${value.slice(0, 320)}...`;
}

async function readStoredState(): Promise<StoredAnalyserWarmthState | null> {
  const stored = await getCachedJson<StoredAnalyserWarmthState>(ANALYSER_WARMTH_CACHE_KEY);
  if (!stored?.warmUntil || !stored.enabledAt || !stored.enabledBy) return null;
  const warmUntilMs = Date.parse(stored.warmUntil);
  if (!Number.isFinite(warmUntilMs) || warmUntilMs <= Date.now()) {
    await deleteCachedKeys([ANALYSER_WARMTH_CACHE_KEY]);
    return null;
  }
  return stored;
}

async function writeStoredState(stored: StoredAnalyserWarmthState): Promise<AnalyserWarmthState> {
  await setCachedJson(ANALYSER_WARMTH_CACHE_KEY, stored, ttlForWarmUntil(stored.warmUntil));
  return toPublicState(stored);
}

export async function getAnalyserWarmthState(): Promise<AnalyserWarmthState> {
  const stored = await readStoredState();
  return stored ? toPublicState(stored) : inactiveState();
}

export async function enableAnalyserWarmth(userId: string): Promise<AnalyserWarmthState> {
  const previous = await readStoredState();
  const now = new Date();
  const warmUntil = new Date(now.getTime() + WARM_WINDOW_MS).toISOString();

  return writeStoredState({
    warmUntil,
    enabledAt: now.toISOString(),
    enabledBy: userId,
    lastWarmupAt: previous?.lastWarmupAt ?? null,
    lastWarmupOk: previous?.lastWarmupOk ?? null,
    lastWarmupError: previous?.lastWarmupError ?? null,
  });
}

export async function disableAnalyserWarmth(): Promise<AnalyserWarmthState> {
  await deleteCachedKeys([ANALYSER_WARMTH_CACHE_KEY]);
  return inactiveState();
}

async function pingHostedAnalyserWarmup(): Promise<{ ok: true } | { ok: false; error: string }> {
  const analyserUrl = process.env.ANALYSER_URL;
  const analyserSecret = process.env.ANALYSER_SHARED_SECRET;
  if (!analyserUrl || !analyserSecret) {
    return {
      ok: false,
      error: 'Song analyser is not configured: set ANALYSER_URL and ANALYSER_SHARED_SECRET.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS);

  try {
    const response = await fetch(analyserUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${analyserSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ warmup: true }),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        error: truncateError(body || `Analyser warm-up returned HTTP ${response.status}.`),
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: truncateError(`Could not warm the song analyser: ${message}`) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function pingAnalyserWarmth(): Promise<AnalyserWarmthPingResult> {
  const result = await pingHostedAnalyserWarmup();
  const warmedAt = new Date().toISOString();
  const latest = await readStoredState();

  if (latest) {
    await writeStoredState({
      ...latest,
      lastWarmupAt: warmedAt,
      lastWarmupOk: result.ok,
      lastWarmupError: result.ok ? null : result.error,
    });
  }

  if (!result.ok) return { ok: false, warmedAt, error: result.error };
  return { ok: true, warmedAt };
}

export async function refreshAnalyserWarmth({
  force = false,
}: {
  force?: boolean;
} = {}): Promise<AnalyserWarmthRefreshResult> {
  const stored = await readStoredState();
  if (!stored) {
    return { ok: true, active: false, skipped: 'inactive', state: inactiveState() };
  }

  const state = toPublicState(stored);
  const lastWarmupMs = stored.lastWarmupAt ? Date.parse(stored.lastWarmupAt) : 0;
  if (
    !force &&
    Number.isFinite(lastWarmupMs) &&
    Date.now() - lastWarmupMs < WARMUP_MIN_INTERVAL_MS
  ) {
    return { ok: true, active: true, skipped: 'recent', state };
  }

  const result = await pingHostedAnalyserWarmup();
  const latest = await readStoredState();
  if (!latest) {
    return { ok: true, active: false, skipped: 'inactive', state: inactiveState() };
  }

  const updated: StoredAnalyserWarmthState = {
    ...latest,
    lastWarmupAt: new Date().toISOString(),
    lastWarmupOk: result.ok,
    lastWarmupError: result.ok ? null : result.error,
  };
  const updatedState = await writeStoredState(updated);

  if (!result.ok) {
    return { ok: false, active: true, error: result.error, state: updatedState };
  }

  return { ok: true, active: true, warmed: true, state: updatedState };
}
