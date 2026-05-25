/**
 * Cache key constants and invalidators for the admin namespace.
 *
 * All admin-facing reads share a single Upstash namespace (`platform:v1:admin`)
 * with a one-minute TTL. Mutations call the matching `invalidate*` helper
 * before returning so the next read repopulates the cache.
 */
import 'server-only';

import { deleteCachedKeys } from '@/lib/server-cache';

/** Top-level platform namespace, also used by non-admin caches. */
export const PLATFORM_CACHE_PREFIX = 'platform:v1';
/** Admin-scoped sub-namespace. All admin keys must extend this prefix. */
export const ADMIN_CACHE_PREFIX = `${PLATFORM_CACHE_PREFIX}:admin`;
/** TTL for short-lived admin reads (users, suppliers, imports, catalogue). */
export const ADMIN_CACHE_TTL_SECONDS = 60;
/** TTL for show templates — they change rarely so we keep them longer. */
export const SHOW_TEMPLATES_TTL_SECONDS = 60 * 10;

/** Cache key for the list of admin users. */
export function getAdminUsersCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:users`;
}

/** Cache key for a single admin user detail blob. */
export function getAdminUserCacheKey(userId: string): string {
  return `${ADMIN_CACHE_PREFIX}:users:${userId}`;
}

/** Cache key for the supplier list. */
export function getAdminSuppliersCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:suppliers`;
}

/** Cache key for the catalogue product list. */
export function getAdminCatalogueCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:catalogue`;
}

/** Cache key for the import job list. */
export function getAdminImportsCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:imports`;
}

/** Cache key for the role list. */
export function getAdminRolesCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:roles`;
}

/** Cache key for the permission list. */
export function getAdminPermissionsCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:permissions`;
}

/**
 * Invalidate the admin user list and (optionally) a single user's detail blob.
 * Call after any mutation that affects role assignments or profile data.
 */
export async function invalidateAdminUsersCache(userId?: string): Promise<void> {
  const keys = [getAdminUsersCacheKey()];
  if (userId) keys.push(getAdminUserCacheKey(userId));
  await deleteCachedKeys(keys);
}

/** Invalidate the cached supplier list. */
export async function invalidateAdminSuppliersCache(): Promise<void> {
  await deleteCachedKeys([getAdminSuppliersCacheKey()]);
}

/** Invalidate the cached catalogue product list. */
export async function invalidateAdminCatalogueCache(): Promise<void> {
  await deleteCachedKeys([getAdminCatalogueCacheKey()]);
}

/** Invalidate the cached import jobs list. */
export async function invalidateAdminImportsCache(): Promise<void> {
  await deleteCachedKeys([getAdminImportsCacheKey()]);
}

/**
 * Invalidate roles. Also clears the user list because user permissions
 * are derived from role membership.
 */
export async function invalidateAdminRolesCache(): Promise<void> {
  await deleteCachedKeys([getAdminRolesCacheKey(), getAdminUsersCacheKey()]);
}

/**
 * Invalidate permissions. Also clears the user list because per-user
 * effective permissions depend on the permission catalogue.
 */
export async function invalidateAdminPermissionsCache(): Promise<void> {
  await deleteCachedKeys([getAdminPermissionsCacheKey(), getAdminUsersCacheKey()]);
}
