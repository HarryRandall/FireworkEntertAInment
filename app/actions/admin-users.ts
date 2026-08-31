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
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import { invalidateAdminUsersCache, requirePermission } from '@/lib/admin.server';
import { invalidateUserProfileCache } from '@/lib/admin/current-user.server';
import { grantAiCredits } from '@/lib/ai-credits.server';
import { getTrustedAppOrigin } from '@/lib/app-origin';
import { sendPasswordRecoveryEmail } from '@/lib/password-recovery-email.server';
import { reservePasswordRecoveryEmailRequest } from '@/lib/password-recovery-rate-limit.server';

type Result = { ok: true } | { ok: false; error: string };

type UserStatusRpcClient = {
  rpc(
    functionName: 'set_user_status',
    args: { p_user_id: string; p_status: 'active' | 'suspended' },
  ): PromiseLike<{ data: string | null; error: { message: string } | null }>;
};

type PermissionOverrideMode = 'grant' | 'deny' | 'clear';

type PermissionOverrideRpcClient = {
  rpc(
    functionName: 'set_user_permission_overrides',
    args: {
      p_user_id: string;
      p_overrides: { permission_id: string; mode: PermissionOverrideMode }[];
    },
  ): PromiseLike<{ data: number | null; error: { message: string } | null }>;
};

const SetStatusSchema = z.object({
  userId: z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase()),
  status: z.enum(['active', 'suspended']),
});

const SetRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

const DeleteUserSchema = z.object({
  userId: z.string().uuid(),
});

const PermissionOverrideSchema = z.object({
  permissionId: z.string().uuid(),
  mode: z.enum(['grant', 'deny', 'clear']),
});

const OverrideSchema = z.object({
  userId: z.string().uuid(),
  ...PermissionOverrideSchema.shape,
});

const OverrideBatchSchema = z
  .object({
    userId: z.string().uuid(),
    overrides: z.array(PermissionOverrideSchema).min(1).max(100),
  })
  .superRefine(({ overrides }, context) => {
    const permissionIds = new Set(overrides.map((override) => override.permissionId));
    if (permissionIds.size !== overrides.length) {
      context.addIssue({
        code: 'custom',
        path: ['overrides'],
        message: 'Each permission can be changed only once.',
      });
    }
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
  const statusRpc = supabase as unknown as UserStatusRpcClient;
  const { data: updatedUserId, error } = await statusRpc.rpc('set_user_status', {
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: error.message };
  if (updatedUserId !== parsed.data.userId) {
    return { ok: false, error: 'Could not update the user status.' };
  }

  await Promise.all([
    invalidateAdminUsersCache(parsed.data.userId),
    invalidateUserProfileCache(parsed.data.userId),
  ]);
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

  const { error: roleAssignmentError } = await supabase.from('user_roles').upsert(
    {
      user_id: parsed.data.userId,
      role_id: parsed.data.roleId,
      assigned_by: admin.id,
    },
    { onConflict: 'user_id' },
  );
  if (roleAssignmentError) return { ok: false, error: roleAssignmentError.message };

  await Promise.all([
    invalidateAdminUsersCache(parsed.data.userId),
    invalidateUserProfileCache(parsed.data.userId),
  ]);
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}

/** Send a real Supabase password-reset email; refuses unknown users. */
export async function sendUserPasswordResetAction(
  input: z.infer<typeof DeleteUserSchema>,
): Promise<Result> {
  const admin = await requirePermission('admin.manage_users');
  if (!admin) return { ok: false, error: 'Not permitted.' };
  const parsed = DeleteUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const service = createServiceRoleSupabase();
  if (!service) return { ok: false, error: 'Service role is not configured.' };
  const { data: target, error: targetError } = await service.auth.admin.getUserById(
    parsed.data.userId,
  );
  if (targetError) return { ok: false, error: targetError.message };
  if (!target.user?.email) {
    return { ok: false, error: 'This user does not have an email address.' };
  }

  const appOrigin = getTrustedAppOrigin();
  if (!appOrigin) {
    return { ok: false, error: 'Password reset is unavailable until APP_ORIGIN is configured.' };
  }
  const allowance = await reservePasswordRecoveryEmailRequest(target.user.email);
  if (!allowance.ok) {
    return {
      ok: false,
      error:
        allowance.reason === 'rate_limited'
          ? 'Password reset requests are temporarily limited. Try again later.'
          : 'Password reset is unavailable until shared recovery protection is configured.',
    };
  }
  const result = await sendPasswordRecoveryEmail(target.user.email, appOrigin);
  if (!result.ok) {
    console.error('[admin-users] password reset email failed:', result.error);
    return { ok: false, error: 'Could not send the password reset email.' };
  }
  return { ok: true };
}

/** Delete the Supabase Auth identity and its cascading app data; refuses self-deletion. */
export async function deleteUserAction(input: z.infer<typeof DeleteUserSchema>): Promise<Result> {
  const admin = await requirePermission('admin.manage_users');
  if (!admin) return { ok: false, error: 'Not permitted.' };
  const parsed = DeleteUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };
  if (parsed.data.userId === admin.id) {
    return { ok: false, error: 'You cannot delete your own account.' };
  }

  const service = createServiceRoleSupabase();
  if (!service) return { ok: false, error: 'Service role is not configured.' };
  const { error } = await service.auth.admin.deleteUser(parsed.data.userId);
  if (error) return { ok: false, error: error.message };

  await Promise.all([
    invalidateAdminUsersCache(parsed.data.userId),
    invalidateUserProfileCache(parsed.data.userId),
  ]);
  revalidatePath('/admin/users');
  return { ok: true };
}

async function applyUserPermissionOverrides(input: unknown): Promise<Result> {
  const admin = await requirePermission('admin.manage_users');
  if (!admin) return { ok: false, error: 'Not permitted.' };
  const parsed = OverrideBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const supabase = createClient(await cookies());
  const overrideRpc = supabase as unknown as PermissionOverrideRpcClient;
  const { data: processedCount, error } = await overrideRpc.rpc('set_user_permission_overrides', {
    p_user_id: parsed.data.userId,
    p_overrides: parsed.data.overrides.map((override) => ({
      permission_id: override.permissionId,
      mode: override.mode,
    })),
  });
  if (error) return { ok: false, error: error.message };
  if (processedCount !== parsed.data.overrides.length) {
    return { ok: false, error: 'Could not update the permission overrides.' };
  }

  await Promise.all([
    invalidateAdminUsersCache(parsed.data.userId),
    invalidateUserProfileCache(parsed.data.userId),
  ]);
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}

/** Grant, deny, or clear an individual RBAC permission override on a user. */
export async function setUserPermissionOverrideAction(
  input: z.infer<typeof OverrideSchema>,
): Promise<Result> {
  const parsed = OverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };
  return applyUserPermissionOverrides({
    userId: parsed.data.userId,
    overrides: [
      {
        permissionId: parsed.data.permissionId,
        mode: parsed.data.mode,
      },
    ],
  });
}

/** Apply a multi-selection RBAC override edit as one database transaction. */
export async function setUserPermissionOverridesAction(
  input: z.infer<typeof OverrideBatchSchema>,
): Promise<Result> {
  return applyUserPermissionOverrides(input);
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
