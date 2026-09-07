/**
 * Cache key builders and invalidators for the shows module.
 *
 * Keys are scoped per-user (`shows:v6:users:<userId>:...`) so a privacy bug in
 * key construction can't accidentally leak another user's cached payload.
 */
import 'server-only';

import { deleteCachedKeys } from '@/lib/server-cache';
import { CACHE_PREFIX } from './types';

export function getUserShowsCacheKey(userId: string): string {
  return `${CACHE_PREFIX}:users:${userId}:shows`;
}

export function getShowBySlugCacheKey(userId: string, slug: string): string {
  return `${CACHE_PREFIX}:users:${userId}:show-by-slug:${slug}`;
}

export function getShowCuesCacheKey(userId: string, showId: string): string {
  return `${CACHE_PREFIX}:users:${userId}:show:${showId}:cues`;
}

export function getShowReplayCuesCacheKey(userId: string, showId: string): string {
  return `${CACHE_PREFIX}:users:${userId}:show:${showId}:replay-cues`;
}

export function getShoppingListCacheKey(userId: string, showId: string): string {
  return `${CACHE_PREFIX}:users:${userId}:show:${showId}:shopping`;
}

export function getFireworkSpecificationsCacheKey(): string {
  return `${CACHE_PREFIX}:firework-specifications:preview-v1`;
}

export function getFireworkProductsCacheKey(lightweight = false): string {
  // v2: payload gained supplier pricing and occupancy durations. Stale v1
  // entries would let generation understate occupancy or miss purchasability.
  return lightweight
    ? `${CACHE_PREFIX}:firework-catalogue-cards:preview-v2`
    : `${CACHE_PREFIX}:firework-products:preview-v2`;
}

/** Invalidate the per-user shows list (e.g. after creating/deleting a show). */
export async function invalidateShowsCacheForUser(userId: string): Promise<void> {
  await deleteCachedKeys([getUserShowsCacheKey(userId)]);
}

/**
 * Invalidate every cached key affected by a single-show mutation: the user's
 * list, the cues, the replay cues, the shopping list, and (when the slug is
 * known) the slug lookup.
 */
export async function invalidateShowCacheForUser(
  userId: string,
  params: { showId: string; showSlug?: string | null },
): Promise<void> {
  const keys = [
    getUserShowsCacheKey(userId),
    getShowCuesCacheKey(userId, params.showId),
    getShowReplayCuesCacheKey(userId, params.showId),
    getShoppingListCacheKey(userId, params.showId),
  ];
  if (params.showSlug) {
    keys.push(getShowBySlugCacheKey(userId, params.showSlug));
  }
  await deleteCachedKeys(keys);
}

/** Drop both firework-catalogue caches. Called after an admin import flow finishes. */
export async function invalidateFireworkCatalogueCaches(): Promise<void> {
  await deleteCachedKeys([
    getFireworkSpecificationsCacheKey(),
    getFireworkProductsCacheKey(false),
    getFireworkProductsCacheKey(true),
  ]);
}
