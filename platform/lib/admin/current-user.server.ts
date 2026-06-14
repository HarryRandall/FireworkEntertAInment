/**
 * Resolve the current user's full RBAC profile.
 *
 * Prefers the SQL `current_user_access` RPC (a single round-trip that joins
 * profile + roles + permissions + overrides) and falls back to a parallel
 * fan-out of individual table reads if the RPC isn't available. The RPC
 * lets us keep RLS-based authorisation in the database where it belongs.
 */
import 'server-only';

import { cache } from 'react';
import { getCurrentUserId } from '@/lib/current-user.server';
import type { CurrentProfile, PermissionKey, RoleKey } from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import {
  asPermissionKey,
  asProfileStatus,
  asRoleKey,
  isRecord,
  mapPermission,
  mapRole,
  unique,
  type RolePermissionRow,
  type UserPermissionOverrideRow,
  type UserRoleRow,
} from './mappers';
import { getServerClient } from './supabase';

/**
 * Parse the JSON returned by the `current_user_access` RPC into a
 * {@link CurrentProfile}. Returns `null` when the shape doesn't match,
 * which causes the caller to fall back to direct table reads.
 */
function parseAccessRpc(value: Json): CurrentProfile | null {
  if (!isRecord(value)) return null;
  const profile = value.profile;
  if (!isRecord(profile) || typeof profile.id !== 'string') return null;
  const roles = Array.isArray(value.roles)
    ? value.roles.filter((role): role is string => typeof role === 'string').map(asRoleKey)
    : [];
  const permissions = Array.isArray(value.permissions)
    ? value.permissions
        .filter((permission): permission is string => typeof permission === 'string')
        .map(asPermissionKey)
    : [];
  return {
    id: profile.id,
    email: typeof profile.email === 'string' ? profile.email : null,
    fullName: typeof profile.full_name === 'string' ? profile.full_name : null,
    phone: typeof profile.phone === 'string' ? profile.phone : null,
    status: typeof profile.status === 'string' ? asProfileStatus(profile.status) : 'active',
    themePreference:
      profile.theme_preference === 'light' || profile.theme_preference === 'system'
        ? profile.theme_preference
        : 'dark',
    roles: roles.length > 0 ? unique(roles) : ['user'],
    permissions: unique(permissions),
  };
}

/**
 * Returns the current user's RBAC profile (roles + effective permissions),
 * or `null` if unauthenticated. Memoised per request.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await getServerClient();
  const { data: accessData, error: accessError } = await supabase.rpc('current_user_access');
  if (!accessError) {
    const parsed = parseAccessRpc(accessData);
    if (parsed) return parsed;
  }

  const [
    { data: profile },
    { data: allRoles },
    { data: userRoles },
    { data: rolePermissions },
    { data: allPermissions },
    { data: overrides },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, full_name, phone, status, theme_preference')
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('roles').select('id, key, name, description, sort_order, created_at, updated_at'),
    supabase
      .from('user_roles')
      .select('user_id, role_id, assigned_by, created_at')
      .eq('user_id', userId),
    supabase.from('role_permissions').select('role_id, permission_id, created_at'),
    supabase
      .from('permissions')
      .select('id, key, name, description, category, created_at, updated_at'),
    supabase
      .from('user_permission_overrides')
      .select('user_id, permission_id, enabled, assigned_by, created_at, updated_at')
      .eq('user_id', userId),
  ]);

  if (!profile) return null;

  const rolesById = new Map((allRoles ?? []).map((role) => [role.id, mapRole(role)]));
  const permissionsById = new Map(
    (allPermissions ?? []).map((permission) => [permission.id, mapPermission(permission)]),
  );
  const roleIds = new Set(((userRoles ?? []) as UserRoleRow[]).map((row) => row.role_id));
  const roleKeys = unique(
    Array.from(roleIds)
      .map((roleId) => rolesById.get(roleId)?.key)
      .filter((key): key is RoleKey => Boolean(key)),
  );

  // Effective permissions = union of role-granted permissions, with per-user
  // overrides applied last (an `enabled=false` override removes a granted
  // permission, an `enabled=true` override grants one not in any role).
  const granted = new Set<PermissionKey>();
  for (const row of (rolePermissions ?? []) as RolePermissionRow[]) {
    if (!roleIds.has(row.role_id)) continue;
    const permission = permissionsById.get(row.permission_id);
    if (permission) granted.add(permission.key);
  }
  for (const override of (overrides ?? []) as UserPermissionOverrideRow[]) {
    const permission = permissionsById.get(override.permission_id);
    if (!permission) continue;
    if (override.enabled) granted.add(permission.key);
    else granted.delete(permission.key);
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    phone: profile.phone,
    status: asProfileStatus(profile.status),
    themePreference:
      profile.theme_preference === 'light' || profile.theme_preference === 'system'
        ? profile.theme_preference
        : 'dark',
    roles: roleKeys.length > 0 ? roleKeys : ['user'],
    permissions: Array.from(granted),
  };
});

/**
 * Returns the current profile if it has the given permission, otherwise `null`.
 * Server actions and admin pages use this as a single-line authorisation check.
 */
export async function requirePermission(permission: PermissionKey) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.permissions.includes(permission)) return null;
  return profile;
}
