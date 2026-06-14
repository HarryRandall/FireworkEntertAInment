/**
 * Read-side helpers for the admin user list and single-user detail.
 *
 * Both helpers gate on `admin.manage_users` and warm a per-user cache so
 * navigating between the list and detail page is fast. {@link getUserActivity}
 * additionally hits the service-role auth admin to read sign-in metadata.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { AdminUser } from '@/lib/admin.types';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import { ADMIN_CACHE_TTL_SECONDS, getAdminUserCacheKey, getAdminUsersCacheKey } from './cache-keys';
import { requirePermission } from './current-user.server';
import {
  mapAdminUsersFromRows,
  type PermissionRow,
  type ProfileRow,
  type RoleRow,
  type UserPermissionOverrideRow,
  type UserRoleRow,
} from './mappers';
import { getServerClient } from './supabase';

/** Returns the full admin user list, or `[]` when the caller lacks the permission. */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const admin = await requirePermission('admin.manage_users');
  if (!admin) return [];

  const cacheKey = getAdminUsersCacheKey();
  const cached = await getCachedJson<AdminUser[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const [
    { data: users },
    { data: userRoles },
    { data: roles },
    { data: overrides },
    { data: permissions },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, full_name, phone, status, updated_at')
      .order('updated_at', { ascending: false }),
    supabase.from('user_roles').select('user_id, role_id, assigned_by, created_at'),
    supabase.from('roles').select('id, key, name, description, sort_order, created_at, updated_at'),
    supabase
      .from('user_permission_overrides')
      .select('user_id, permission_id, enabled, assigned_by, created_at, updated_at'),
    supabase
      .from('permissions')
      .select('id, key, name, description, category, created_at, updated_at'),
  ]);

  const mapped = mapAdminUsersFromRows({
    users: (users ?? []) as Pick<
      ProfileRow,
      'id' | 'email' | 'full_name' | 'phone' | 'status' | 'updated_at'
    >[],
    userRoles: (userRoles ?? []) as UserRoleRow[],
    roles: (roles ?? []) as RoleRow[],
    overrides: (overrides ?? []) as UserPermissionOverrideRow[],
    permissions: (permissions ?? []) as PermissionRow[],
  });
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

/** Returns a single admin user, or `null` when missing or unauthorised. Cached. */
export async function getAdminUserById(userId: string): Promise<AdminUser | null> {
  if (!(await requirePermission('admin.manage_users'))) return null;

  const cacheKey = getAdminUserCacheKey(userId);
  const cached = await getCachedJson<AdminUser>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const [
    { data: profile, error: profileError },
    { data: userRoles },
    { data: roles },
    { data: overrides },
    { data: permissions },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, full_name, phone, status, updated_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('user_id, role_id, assigned_by, created_at')
      .eq('user_id', userId),
    supabase.from('roles').select('id, key, name, description, sort_order, created_at, updated_at'),
    supabase
      .from('user_permission_overrides')
      .select('user_id, permission_id, enabled, assigned_by, created_at, updated_at')
      .eq('user_id', userId),
    supabase
      .from('permissions')
      .select('id, key, name, description, category, created_at, updated_at'),
  ]);

  if (profileError) {
    console.error('[admin.server] getAdminUserById failed:', profileError);
    return null;
  }
  if (!profile) return null;

  const [mapped] = mapAdminUsersFromRows({
    users: [
      profile as Pick<ProfileRow, 'id' | 'email' | 'full_name' | 'phone' | 'status' | 'updated_at'>,
    ],
    userRoles: (userRoles ?? []) as UserRoleRow[],
    roles: (roles ?? []) as RoleRow[],
    overrides: (overrides ?? []) as UserPermissionOverrideRow[],
    permissions: (permissions ?? []) as PermissionRow[],
  });
  if (mapped) {
    await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  }
  return mapped ?? null;
}

/**
 * Per-user activity rollup shown on the admin user detail page.
 * `shows30d` is bucketed daily for the last 30 days (zeroes included).
 */
export type UserActivity = {
  shows30d: { date: string; count: number }[];
  stats: {
    accountAgeDays: number | null;
    lastSignInAt: string | null;
    totalShows: number;
    shows30dCount: number;
  };
};

/**
 * Returns activity stats for a user, or `null` if unauthorised.
 *
 * Uses the service-role client so we can read auth metadata that's hidden
 * from the user-scoped client. Falls back to the user-scoped client when
 * service role isn't configured (sign-in stats become null in that case).
 */
export async function getUserActivity(userId: string): Promise<UserActivity | null> {
  if (!(await requirePermission('admin.manage_users'))) return null;

  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  const service = createServiceRoleSupabase();
  const supabase = service ?? (await getServerClient());

  const [{ data: showsAll }, { data: showsRecent }] = await Promise.all([
    supabase.from('shows').select('id', { count: 'exact', head: false }).eq('user_id', userId),
    supabase.from('shows').select('created_at').eq('user_id', userId).gte('created_at', sinceIso),
  ]);

  // Pre-fill 30 daily buckets so the UI always renders a contiguous chart,
  // even if the user created zero shows on a given day.
  const buckets = new Map<string, number>();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of (showsRecent ?? []) as { created_at: string }[]) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const shows30d = Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));

  let lastSignInAt: string | null = null;
  let accountAgeDays: number | null = null;
  if (service) {
    const { data: authUser } = await service.auth.admin.getUserById(userId);
    if (authUser?.user) {
      lastSignInAt = authUser.user.last_sign_in_at ?? null;
      const createdAt = authUser.user.created_at ?? null;
      if (createdAt) {
        const ms = now.getTime() - new Date(createdAt).getTime();
        accountAgeDays = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
      }
    }
  }

  return {
    shows30d,
    stats: {
      accountAgeDays,
      lastSignInAt,
      totalShows: showsAll?.length ?? 0,
      shows30dCount: (showsRecent ?? []).length,
    },
  };
}
