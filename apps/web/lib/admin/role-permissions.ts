import type { PermissionKey, RoleKey } from '@/lib/admin.types';

export const LOCKED_ADMIN_PERMISSION_KEYS = ['admin.view', 'admin.manage_users'] as const;

export function isLockedRolePermission(roleKey: RoleKey, permissionKey: PermissionKey) {
  return (
    roleKey === 'admin' &&
    (LOCKED_ADMIN_PERMISSION_KEYS as readonly PermissionKey[]).includes(permissionKey)
  );
}
