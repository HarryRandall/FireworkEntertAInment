/** Admin roles page for editing role-level permission defaults. */

import { redirect } from 'next/navigation';
import { FilterBar } from '@/app/components/ui/FilterBar';
import { listRolePermissionMatrix } from '@/lib/admin.server';
import type { Permission } from '@/lib/admin.types';
import { RolePermissionMatrix } from './RolePermissionMatrix';

type PageProps = {
  searchParams: Promise<{ q?: string; category?: string; role?: string }>;
};

function formatPermissionArea(category: string) {
  const labels: Record<string, string> = {
    admin: 'Platform access',
    shows: 'Show builder',
    supplier: 'Supplier workspace',
  };
  return (
    labels[category] ??
    category.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function matchesPermission(permission: Permission, query: string) {
  if (!query) return true;
  const haystack = [permission.name, permission.description, permission.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function groupPermissions(permissions: Permission[]) {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const current = groups.get(permission.category) ?? [];
    current.push(permission);
    groups.set(permission.category, current);
  }
  return Array.from(groups.entries());
}

export default async function AdminRolesPage({ searchParams }: PageProps) {
  const matrix = await listRolePermissionMatrix();
  if (!matrix) redirect('/admin');

  const params = await searchParams;
  const query = (params.q ?? '').trim().toLowerCase();
  const categories = Array.from(
    new Set(matrix.permissions.map((permission) => permission.category)),
  );
  const categoryFilter = categories.includes(params.category ?? '') ? params.category : undefined;
  const roleFilter = matrix.roles.some((role) => role.key === params.role)
    ? params.role
    : undefined;
  const roles = roleFilter ? matrix.roles.filter((role) => role.key === roleFilter) : matrix.roles;
  const permissions = matrix.permissions.filter(
    (permission) =>
      matchesPermission(permission, query) &&
      (!categoryFilter || permission.category === categoryFilter),
  );
  const groupedPermissions = groupPermissions(permissions);
  const grantKeys = new Set(matrix.grants.map((grant) => `${grant.roleId}:${grant.permissionId}`));
  const filters = [
    {
      key: 'category',
      label: 'Area',
      type: 'select' as const,
      options: categories.map((category) => ({
        value: category,
        label: formatPermissionArea(category),
      })),
    },
    {
      key: 'role',
      label: 'Role',
      type: 'select' as const,
      options: matrix.roles.map((role) => ({
        value: role.key,
        label: role.name,
      })),
    },
  ];

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8">
      <FilterBar searchPlaceholder="Search permissions by name or area…" filters={filters} />

      <RolePermissionMatrix
        groupedPermissions={groupedPermissions}
        roles={roles}
        grantKeys={grantKeys}
      />
    </div>
  );
}
