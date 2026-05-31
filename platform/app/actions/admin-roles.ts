'use server';

/**
 * Admin role management actions. These edit role default permissions and are
 * gated by the same `admin.manage_users` permission as user role assignment.
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { isLockedRolePermission } from '@/lib/admin/role-permissions';
import {
  asPermissionKey,
  asRoleKey,
  invalidateAdminRolePermissionsCache,
  requirePermission,
} from '@/lib/admin.server';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

type Result = { ok: true } | { ok: false; error: string };

const SetRolePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
  enabled: z.boolean(),
});

/** Grant or remove a permission from a role's defaults. */
export async function setRolePermissionAction(
  input: z.infer<typeof SetRolePermissionSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_users'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = SetRolePermissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const supabase = createClient(await cookies());
  const [{ data: role, error: roleError }, { data: permission, error: permissionError }] =
    await Promise.all([
      supabase.from('roles').select('id, key').eq('id', parsed.data.roleId).maybeSingle(),
      supabase
        .from('permissions')
        .select('id, key')
        .eq('id', parsed.data.permissionId)
        .maybeSingle(),
    ]);

  if (roleError) return { ok: false, error: roleError.message };
  if (permissionError) return { ok: false, error: permissionError.message };
  if (!role || !permission) return { ok: false, error: 'Choose a valid role and permission.' };

  if (isLockedRolePermission(asRoleKey(role.key), asPermissionKey(permission.key))) {
    return { ok: false, error: 'Admin access permissions are required.' };
  }

  const writeSupabase = createServiceRoleSupabase() ?? supabase;
  if (parsed.data.enabled) {
    const { error } = await writeSupabase.from('role_permissions').upsert({
      role_id: parsed.data.roleId,
      permission_id: parsed.data.permissionId,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await writeSupabase
      .from('role_permissions')
      .delete()
      .eq('role_id', parsed.data.roleId)
      .eq('permission_id', parsed.data.permissionId);
    if (error) return { ok: false, error: error.message };
  }

  await invalidateAdminRolePermissionsCache();
  revalidatePath('/admin/roles');
  revalidatePath('/admin/users');
  revalidatePath('/admin/users/[id]', 'page');
  return { ok: true };
}
