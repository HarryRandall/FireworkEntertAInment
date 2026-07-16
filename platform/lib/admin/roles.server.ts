/**
 * Read-side helpers for the role + permission catalogues.
 *
 * These read-only lists drive the admin UI's role and permission pickers.
 * They're cached for {@link ADMIN_CACHE_TTL_SECONDS} since the catalogues
 * change rarely.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { Permission, Role, RolePermissionMatrix } from '@/lib/admin.types';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminPermissionsCacheKey,
  getAdminRolePermissionMatrixCacheKey,
  getAdminRolesCacheKey,
} from './cache-keys';
import { requirePermission } from './current-user.server';
import {
  mapPermission,
  mapRole,
  type PermissionRow,
  type RolePermissionRow,
  type RoleRow,
} from './mappers';
import { getServerClient } from './supabase';

type AdminRoleReadFailure = {
  source: string;
  error: unknown;
};

function throwAdminRoleReadError(operation: string, failures: AdminRoleReadFailure[]): never {
  console.error(`[admin.roles] ${operation} failed:`, failures);
  throw new Error('Admin role and permission data could not be loaded.', {
    cause: failures[0]?.error,
  });
}

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
    throwAdminRoleReadError('listRoles', [{ source: 'roles', error }]);
  }
  const mapped = (data ?? []).map(mapRole);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

/** Returns role defaults joined to the role and permission catalogues. Cached. */
export async function listRolePermissionMatrix(): Promise<RolePermissionMatrix | null> {
  if (!(await requirePermission('admin.manage_users'))) return null;

  const cacheKey = getAdminRolePermissionMatrixCacheKey();
  const cached = await getCachedJson<RolePermissionMatrix>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const [
    { data: roles, error: rolesError },
    { data: permissions, error: permissionsError },
    { data: grants, error: grantsError },
  ] = await Promise.all([
    supabase
      .from('roles')
      .select('id, key, name, description, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true }),
    supabase
      .from('permissions')
      .select('id, key, name, description, category, created_at, updated_at')
      .order('category', { ascending: true })
      .order('key', { ascending: true }),
    supabase.from('role_permissions').select('role_id, permission_id, created_at'),
  ]);

  if (rolesError || permissionsError || grantsError) {
    throwAdminRoleReadError(
      'listRolePermissionMatrix',
      [
        { source: 'roles', error: rolesError },
        { source: 'permissions', error: permissionsError },
        { source: 'role permission grants', error: grantsError },
      ].filter(({ error }) => error !== null),
    );
  }

  const mapped: RolePermissionMatrix = {
    roles: ((roles ?? []) as RoleRow[]).map(mapRole),
    permissions: ((permissions ?? []) as PermissionRow[]).map(mapPermission),
    grants: ((grants ?? []) as RolePermissionRow[]).map((grant) => ({
      roleId: grant.role_id,
      permissionId: grant.permission_id,
    })),
  };

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
    throwAdminRoleReadError('listPermissions', [{ source: 'permissions', error }]);
  }
  const mapped = (data ?? []).map(mapPermission);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
