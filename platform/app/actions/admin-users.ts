'use server';

/**
 * Admin user management server actions: set status, assign role,
 * delete user, and toggle RBAC permission overrides. All actions
 * are gated by the `admin.manage_users` RBAC permission.
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { invalidateAdminUsersCache, requirePermission } from '@/lib/admin.server';
import { grantAiCredits } from '@/lib/ai-credits.server';

type Result = { ok: true } | { ok: false; error: string };

const SELF_LOCKOUT_PERMISSION_KEYS = new Set(['admin.view', 'admin.manage_users']);

const SetStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['active', 'suspended']),
});

const SetRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

const DeleteUserSchema = z.object({
  userId: z.string().uuid(),
});

const OverrideSchema = z.object({
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  mode: z.enum(['grant', 'deny', 'clear']),
});

const GrantAiCreditsSchema = z.object({
  userId: z.string().uuid(),
  amount: z.coerce.number().int().min(1).max(100_000),
  note: z.string().trim().max(280).optional(),
});

/** Set a user's `users.status` (active / suspended); refuses to suspend the current admin. */
export async function setUserStatusAction(input: z.infer<typeof SetStatusSchema>): Promise<Result> {
  const admin = await requirePermission('admin.manage_users');
  if (!admin) return { ok: false, error: 'Not permitted.' };
  const parsed = SetStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };
  if (parsed.data.userId === admin.id && parsed.data.status === 'suspended') {
    return { ok: false, error: 'You cannot suspend your own account.' };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('users')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.userId);
  if (error) return { ok: false, error: error.message };

  await invalidateAdminUsersCache(parsed.data.userId);
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}

/** Replace a user's RBAC role assignment with the given role. */
export async function setUserRoleAction(input: z.infer<typeof SetRoleSchema>): Promise<Result> {
  const admin = await requirePermission('admin.manage_users');
  if (!admin) return { ok: false, error: 'Not permitted.' };
  const parsed = SetRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };
  if (parsed.data.userId === admin.id) {
    return { ok: false, error: 'You cannot change your own role.' };
  }

  const supabase = createClient(await cookies());
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('id', parsed.data.roleId)
    .maybeSingle();
  if (roleError) return { ok: false, error: roleError.message };
  if (!role) return { ok: false, error: 'Choose a valid role.' };

  const { error: deleteError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', parsed.data.userId);
  if (deleteError) return { ok: false, error: deleteError.message };

  const { error: insertError } = await supabase.from('user_roles').insert({
    user_id: parsed.data.userId,
    role_id: parsed.data.roleId,
    assigned_by: admin.id,
  });
  if (insertError) return { ok: false, error: insertError.message };

  await invalidateAdminUsersCache(parsed.data.userId);
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}

/** Delete a user's `users` row; refuses to delete the current admin. */
export async function deleteUserAction(input: z.infer<typeof DeleteUserSchema>): Promise<Result> {
  const admin = await requirePermission('admin.manage_users');
  if (!admin) return { ok: false, error: 'Not permitted.' };
  const parsed = DeleteUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };
  if (parsed.data.userId === admin.id) {
    return { ok: false, error: 'You cannot delete your own account.' };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.from('users').delete().eq('id', parsed.data.userId);
  if (error) return { ok: false, error: error.message };

  await invalidateAdminUsersCache(parsed.data.userId);
  revalidatePath('/admin/users');
  return { ok: true };
}

/** Grant, deny, or clear an individual RBAC permission override on a user. */
export async function setUserPermissionOverrideAction(
  input: z.infer<typeof OverrideSchema>,
): Promise<Result> {
  const admin = await requirePermission('admin.manage_users');
  if (!admin) return { ok: false, error: 'Not permitted.' };
  const parsed = OverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const supabase = createClient(await cookies());
  if (parsed.data.userId === admin.id && parsed.data.mode === 'deny') {
    const { data: permission, error: permissionError } = await supabase
      .from('permissions')
      .select('key')
      .eq('id', parsed.data.permissionId)
      .maybeSingle();
    if (permissionError) return { ok: false, error: permissionError.message };
    if (permission && SELF_LOCKOUT_PERMISSION_KEYS.has(permission.key)) {
      return { ok: false, error: 'You cannot deny your own admin access.' };
    }
  }

  if (parsed.data.mode === 'clear') {
    const { error } = await supabase
      .from('user_permission_overrides')
      .delete()
      .eq('user_id', parsed.data.userId)
      .eq('permission_id', parsed.data.permissionId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('user_permission_overrides').upsert({
      user_id: parsed.data.userId,
      permission_id: parsed.data.permissionId,
      enabled: parsed.data.mode === 'grant',
      assigned_by: admin.id,
    });
    if (error) return { ok: false, error: error.message };
  }

  await invalidateAdminUsersCache(parsed.data.userId);
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}

/** Grant AI credits to a user from the admin user detail page. */
export async function grantUserAiCreditsAction(
  input: z.infer<typeof GrantAiCreditsSchema>,
): Promise<Result> {
  const admin = await requirePermission('admin.manage_billing');
  if (!admin) return { ok: false, error: 'Not permitted.' };
  const parsed = GrantAiCreditsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const result = await grantAiCredits({
    userId: parsed.data.userId,
    amount: parsed.data.amount,
    note: parsed.data.note ?? '',
  });
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not grant AI credits.' };

  await invalidateAdminUsersCache(parsed.data.userId);
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath('/settings/billing');
  return { ok: true };
}
