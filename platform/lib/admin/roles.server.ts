/**
 * Read-side helpers for the role + permission catalogues.
 *
 * These read-only lists drive the admin UI's role and permission pickers.
 * They're cached for {@link ADMIN_CACHE_TTL_SECONDS} since the catalogues
 * change rarely.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { Permission, Role } from '@/lib/admin.types';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminPermissionsCacheKey,
  getAdminRolesCacheKey,
} from './cache-keys';
import { mapPermission, mapRole } from './mappers';
import { getServerClient } from './supabase';

/** Returns all roles ordered by `sort_order`. Cached. */
export async function listRoles(): Promise<Role[]> {
  const cacheKey = getAdminRolesCacheKey();
  const cached = await getCachedJson<Role[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('roles')
    .select('id, key, name, description, sort_order, created_at, updated_at')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[admin.server] listRoles failed:', error);
    return [];
  }
  const mapped = (data ?? []).map(mapRole);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

/** Returns all permissions ordered by category then key. Cached. */
export async function listPermissions(): Promise<Permission[]> {
  const cacheKey = getAdminPermissionsCacheKey();
  const cached = await getCachedJson<Permission[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('permissions')
    .select('id, key, name, description, category, created_at, updated_at')
    .order('category', { ascending: true })
    .order('key', { ascending: true });
  if (error) {
    console.error('[admin.server] listPermissions failed:', error);
    return [];
  }
  const mapped = (data ?? []).map(mapPermission);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
