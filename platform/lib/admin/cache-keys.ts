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

/** Cache key for overview-only platform metrics. */
export function getAdminOverviewCacheKey(rangeKey = 'last-4-weeks'): string {
  return `${ADMIN_CACHE_PREFIX}:overview:${rangeKey}`;
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

/** Cache key for the reusable effect-spec list. */
export function getAdminEffectsCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:effects:preview-v1`;
}

/** Cache key for one effect-spec detail view. */
export function getAdminEffectCacheKey(effectId: string): string {
  return `${ADMIN_CACHE_PREFIX}:effects:${effectId}:preview-v1`;
}

/** Cache key for reusable firework star/trail defaults. */
export function getAdminStyleDefaultsCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:style-defaults`;
}

/** Cache key for one reusable firework star/trail default. */
export function getAdminStyleDefaultCacheKey(defaultId: string): string {
  return `${ADMIN_CACHE_PREFIX}:style-defaults:${defaultId}`;
}

/** Cache key for product-level fireworks joined to their effect shots. */
export function getAdminFireworksCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:fireworks:preview-v1`;
}

/** Cache key for one product-level firework detail editor. */
export function getAdminFireworkCacheKey(productId: string): string {
  return `${ADMIN_CACHE_PREFIX}:fireworks:${productId}:preview-v1`;
}

/** Cache key for the multishot composition list. */
export function getAdminMultishotsCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:multishots:preview-v1`;
}

/** Cache key for one multishot detail editor. */
export function getAdminMultishotCacheKey(multishotId: string): string {
  return `${ADMIN_CACHE_PREFIX}:multishots:${multishotId}:preview-v1`;
}

/** Cache key for the import job list. */
export function getAdminImportsCacheKey(view: 'active' | 'archived' = 'active'): string {
  return `${ADMIN_CACHE_PREFIX}:imports:${view}`;
}

/** Cache key for the role list. */
export function getAdminRolesCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:roles`;
}

/** Cache key for the permission list. */
export function getAdminPermissionsCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:permissions`;
}

/** Cache key for role permission defaults joined to roles and permissions. */
export function getAdminRolePermissionMatrixCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:role-permissions`;
}

/** Cache key for editable prompt configuration rows. */
export function getAdminPromptConfigsCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:prompt-configs`;
}

/** Cache key for admin generation settings. */
export function getAdminGenerationSettingsCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:generation-settings`;
}

/** Cache key for public curated show presets. */
export function getShowTemplatesCacheKey(): string {
  // Keep cue-bearing list payloads from surviving the summary-only rollout.
  return `${PLATFORM_CACHE_PREFIX}:show-templates:database-v4`;
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

/** Invalidate effect-spec list/detail reads. */
export async function invalidateAdminEffectsCache(effectId?: string): Promise<void> {
  const keys = [getAdminEffectsCacheKey()];
  if (effectId) keys.push(getAdminEffectCacheKey(effectId));
  await deleteCachedKeys(keys);
}

/** Invalidate reusable firework style defaults. */
export async function invalidateAdminStyleDefaultsCache(defaultId?: string): Promise<void> {
  const keys = [getAdminStyleDefaultsCacheKey()];
  if (defaultId) keys.push(getAdminStyleDefaultCacheKey(defaultId));
  await deleteCachedKeys(keys);
}

/** Invalidate product-level firework reads. */
export async function invalidateAdminFireworksCache(productId?: string): Promise<void> {
  const keys = [getAdminFireworksCacheKey()];
  if (productId) keys.push(getAdminFireworkCacheKey(productId));
  await deleteCachedKeys(keys);
}

/** Invalidate multishot composition reads. */
export async function invalidateAdminMultishotsCache(multishotId?: string): Promise<void> {
  const keys = [getAdminMultishotsCacheKey()];
  if (multishotId) keys.push(getAdminMultishotCacheKey(multishotId));
  await deleteCachedKeys(keys);
}

/** Invalidate the cached import jobs list. */
export async function invalidateAdminImportsCache(): Promise<void> {
  await deleteCachedKeys([getAdminImportsCacheKey('active'), getAdminImportsCacheKey('archived')]);
}

/**
 * Invalidate roles. Also clears the user list because user permissions
 * are derived from role membership.
 */
export async function invalidateAdminRolesCache(): Promise<void> {
  await deleteCachedKeys([
    getAdminRolesCacheKey(),
    getAdminRolePermissionMatrixCacheKey(),
    getAdminUsersCacheKey(),
  ]);
}

/**
 * Invalidate permissions. Also clears the user list because per-user
 * effective permissions depend on the permission catalogue.
 */
export async function invalidateAdminPermissionsCache(): Promise<void> {
  await deleteCachedKeys([
    getAdminPermissionsCacheKey(),
    getAdminRolePermissionMatrixCacheKey(),
    getAdminUsersCacheKey(),
  ]);
}

/** Invalidate role permission defaults and user-facing permission rollups. */
export async function invalidateAdminRolePermissionsCache(): Promise<void> {
  await deleteCachedKeys([getAdminRolePermissionMatrixCacheKey(), getAdminUsersCacheKey()]);
}

/** Invalidate editable prompt configuration reads. */
export async function invalidateAdminPromptConfigsCache(): Promise<void> {
  await deleteCachedKeys([getAdminPromptConfigsCacheKey(), getAdminGenerationSettingsCacheKey()]);
}

/** Invalidate public/admin curated show-preset reads. */
export async function invalidateShowTemplatesCache(): Promise<void> {
  await deleteCachedKeys([getShowTemplatesCacheKey()]);
}
