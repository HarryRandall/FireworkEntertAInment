/**
 * Optional Upstash Redis JSON cache (server-only).
 *
 * The cache is best-effort: if Upstash credentials are missing, malformed, or
 * still set to placeholders, every helper degrades to a no-op rather than
 * throwing. This means feature code can safely call {@link getCachedJson} /
 * {@link setCachedJson} without branching on configuration.
 *
 * Cache keys are namespaced by callers (e.g. `platform:v1:admin:users`) so
 * the prefix scheme lives with each consumer rather than here.
 */
import 'server-only';

import { Redis } from '@upstash/redis';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

/**
 * Require real Upstash REST credentials — env.example placeholders must not
 * instantiate a client or every get/set pays DNS/connect timeouts (~seconds).
 */
function resolveUpstashRestConfig(): { url: string; token: string } | null {
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? '';
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? '';
  if (!rawUrl || !rawToken) return null;

  if (rawToken === 'your-upstash-token') return null;

  let hostname = '';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }

  if (hostname === 'your-cache.upstash.io' || !hostname.endsWith('.upstash.io')) return null;

  return { url: rawUrl, token: rawToken };
}

const redisConfig = resolveUpstashRestConfig();
const redis = redisConfig ? new Redis({ url: redisConfig.url, token: redisConfig.token }) : null;

const CACHE_TTL_SECONDS = 60;
const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();
const memoryRateLimits = new Map<string, { count: number; expiresAt: number }>();

function getRedisClient() {
  return redis;
}

export function hasRedisCache() {
  return Boolean(getRedisClient());
}

export type FixedWindowRateLimitResult = {
  allowed: boolean;
  available: boolean;
  count: number;
  retryAfterSeconds: number;
  durable: boolean;
};

export type FixedWindowRateLimit = {
  key: string;
  limit: number;
  windowSeconds: number;
};

/**
 * Atomically consume a set of fixed-window allowances. Security-sensitive callers
 * must require `durable` in production because the memory fallback is scoped
 * to one server process.
 */
export async function consumeFixedWindowRateLimits(
  limits: readonly FixedWindowRateLimit[],
): Promise<FixedWindowRateLimitResult> {
  if (limits.length === 0) {
    return {
      allowed: true,
      available: true,
      count: 0,
      retryAfterSeconds: 0,
      durable: Boolean(getRedisClient()),
    };
  }

  const client = getRedisClient();
  if (!client) {
    const now = Date.now();
    const entries = limits.map((limit) => {
      const existing = memoryRateLimits.get(limit.key);
      return existing && existing.expiresAt > now
        ? existing
        : { count: 0, expiresAt: now + limit.windowSeconds * 1_000 };
    });
    const deniedIndex = entries.findIndex((entry, index) => entry.count >= limits[index].limit);
    if (deniedIndex >= 0) {
      const denied = entries[deniedIndex];
      return {
        allowed: false,
        available: true,
        count: denied.count,
        retryAfterSeconds: Math.max(1, Math.ceil((denied.expiresAt - now) / 1_000)),
        durable: false,
      };
    }

    const consumed = entries.map((entry, index) => {
      const next = { count: entry.count + 1, expiresAt: entry.expiresAt };
      memoryRateLimits.set(limits[index].key, next);
      return next;
    });
    return {
      allowed: true,
      available: true,
      count: Math.max(...consumed.map((entry) => entry.count)),
      retryAfterSeconds: Math.max(
        1,
        ...consumed.map((entry) => Math.ceil((entry.expiresAt - now) / 1_000)),
      ),
      durable: false,
    };
  }

  try {
    const [rawAllowed, , rawCount, rawTtl] = await client.eval<
      number[],
      [number, number, number, number]
    >(
      `for index, key in ipairs(KEYS) do
  local current = tonumber(redis.call('GET', key) or '0')
  local limit = tonumber(ARGV[((index - 1) * 2) + 1])
  if current >= limit then
    return { 0, index, current, redis.call('TTL', key) }
  end
end

local highest = 0
local longest_ttl = 1
for index, key in ipairs(KEYS) do
  local window = tonumber(ARGV[((index - 1) * 2) + 2])
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('EXPIRE', key, window) end
  local ttl = redis.call('TTL', key)
  if count > highest then highest = count end
  if ttl > longest_ttl then longest_ttl = ttl end
end
return { 1, 0, highest, longest_ttl }`,
      limits.map((limit) => limit.key),
      limits.flatMap((limit) => [limit.limit, limit.windowSeconds]),
    );
    const allowed = Number(rawAllowed) === 1;
    const count = Number(rawCount);
    const retryAfterSeconds = Math.max(1, Number(rawTtl));
    return {
      allowed: allowed && Number.isFinite(count),
      available: Number.isFinite(count),
      count: Number.isFinite(count) ? count : 1,
      retryAfterSeconds,
      durable: true,
    };
  } catch (error) {
    console.error('[server-cache] rate limit failed:', error);
    return {
      allowed: false,
      available: false,
      count: 1,
      retryAfterSeconds: Math.max(...limits.map((limit) => limit.windowSeconds)),
      durable: true,
    };
  }
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) {
    const cached = memoryCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return cached.value as T;
  }

  try {
    const value = await client.get<T>(key);
    return value ?? null;
  } catch (error) {
    console.error('[server-cache] get failed:', error);
    return null;
  }
}

export async function setCachedJson<T>(
  key: string,
  value: T,
  ttlSeconds = CACHE_TTL_SECONDS,
): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    memoryCache.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value,
    });
    return;
  }

  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.error('[server-cache] set failed:', error);
  }
}

export async function deleteCachedKeys(keys: string[]): Promise<void> {
  const client = getRedisClient();
  keys.forEach((key) => memoryCache.delete(key));
  if (!client || keys.length === 0) return;

  try {
    await Promise.all(keys.map((key) => client.del(key)));
  } catch (error) {
    console.error('[server-cache] delete failed:', error);
  }
}
