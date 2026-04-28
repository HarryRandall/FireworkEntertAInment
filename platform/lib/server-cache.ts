import "server-only";

import { Redis } from "@upstash/redis";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

const CACHE_TTL_SECONDS = 60;

function getRedisClient() {
  return redis;
}

export function hasRedisCache() {
  return Boolean(getRedisClient());
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get<T>(key);
    return value ?? null;
  } catch (error) {
    console.error("[server-cache] get failed:", error);
    return null;
  }
}

export async function setCachedJson<T extends JsonValue>(
  key: string,
  value: T,
  ttlSeconds = CACHE_TTL_SECONDS,
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.error("[server-cache] set failed:", error);
  }
}

export async function deleteCachedKeys(keys: string[]): Promise<void> {
  const client = getRedisClient();
  if (!client || keys.length === 0) return;

  try {
    await Promise.all(keys.map((key) => client.del(key)));
  } catch (error) {
    console.error("[server-cache] delete failed:", error);
  }
}
