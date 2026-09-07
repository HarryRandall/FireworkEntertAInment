import type { WorkspaceSummary } from '@/lib/show-summary';

export type SidebarAiUsage = {
  balance: number;
  available: number;
  reserved: number;
  includedCredits: number;
  hourlyLimit: number;
  weeklyLimit: number;
  hourlyUsed: number;
  weeklyUsed: number;
  hourlyRemaining: number;
  weeklyRemaining: number;
  totalGranted: number;
  totalSpent: number;
};

export type CachedWorkspaceSummary = WorkspaceSummary & {
  aiUsage?: SidebarAiUsage | null;
  cachedAt?: number;
};

const CACHE_KEY_PREFIX = 'sc:workspace-summary:v3';
const CACHE_TTL_MS = 60_000;

function cacheKey(profileId: string): string {
  return `${CACHE_KEY_PREFIX}:${profileId}`;
}

export function readCachedWorkspaceSummary(
  profileId: string | null,
): CachedWorkspaceSummary | null {
  if (typeof window === 'undefined' || !profileId) return null;

  try {
    const raw = window.sessionStorage.getItem(cacheKey(profileId));
    return raw ? (JSON.parse(raw) as CachedWorkspaceSummary) : null;
  } catch {
    return null;
  }
}

export function isWorkspaceSummaryFresh(summary: CachedWorkspaceSummary | null): boolean {
  return Boolean(summary?.cachedAt && Date.now() - summary.cachedAt < CACHE_TTL_MS);
}

export function writeCachedWorkspaceSummary(
  profileId: string | null,
  summary: CachedWorkspaceSummary | null,
): void {
  if (typeof window === 'undefined' || !profileId) return;

  try {
    const key = cacheKey(profileId);
    if (summary) {
      window.sessionStorage.setItem(key, JSON.stringify(summary));
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage is an optional optimisation. The shell fetches fresh data when it is unavailable.
  }
}

export function clearCachedAiUsage(profileId: string | null): void {
  const cached = readCachedWorkspaceSummary(profileId);
  if (!cached) return;

  writeCachedWorkspaceSummary(profileId, { ...cached, aiUsage: null, cachedAt: 0 });
}
