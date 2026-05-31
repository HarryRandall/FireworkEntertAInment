/** Custom permission matrix for editing role-level defaults. */

import type { CSSProperties } from 'react';
import { Card } from '@/app/components/ui/Card';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { isLockedRolePermission } from '@/lib/admin/role-permissions';
import type { Permission, Role } from '@/lib/admin.types';
import { RolePermissionToggle } from './RolePermissionToggle';

type PermissionGroup = [category: string, permissions: Permission[]];

type Props = {
  groupedPermissions: PermissionGroup[];
  roles: Role[];
  grantKeys: Set<string>;
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

export function RolePermissionMatrix({ groupedPermissions, roles, grantKeys }: Props) {
  return (
    <Card
      radius="xl"
      className="flex min-h-[420px] flex-1 flex-col overflow-hidden lg:max-h-[calc(100dvh-14rem)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border-subtle)] px-5 py-4">
        <h2 className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
          Role defaults
        </h2>
        <span className="text-xs text-[color:var(--color-content-subtle)]">
          Changes save automatically.
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div
          className="min-w-[760px]"
          style={
            {
              '--role-columns': `minmax(220px,1.05fr) repeat(${roles.length}, minmax(124px,0.8fr))`,
            } as CSSProperties
          }
        >
          <RoleMatrixHeader roles={roles} />

          {groupedPermissions.length > 0 ? (
            groupedPermissions.map(([category, permissions]) => (
              <RolePermissionGroup
                key={category}
                category={category}
                permissions={permissions}
                roles={roles}
                grantKeys={grantKeys}
              />
            ))
          ) : (
            <div className="px-5 py-12 text-center text-sm text-[color:var(--color-content-subtle)]">
              No permissions match the current filters.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function RoleMatrixHeader({ roles }: { roles: Role[] }) {
  return (
    <div className="sticky top-0 z-10 grid grid-cols-[var(--role-columns)] items-center border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] px-5 py-4">
      <div className="text-xs font-medium tracking-wide text-[color:var(--color-content-subtle)] uppercase">
        Permission
      </div>
      {roles.map((role) => (
        <div
          key={role.id}
          className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold tracking-wide text-[color:var(--color-content-emphasis)] uppercase"
        >
          {role.name}
          {role.description ? <InfoTooltip text={role.description} /> : null}
        </div>
      ))}
    </div>
  );
}

function RolePermissionGroup({
  category,
  permissions,
  roles,
  grantKeys,
}: {
  category: string;
  permissions: Permission[];
  roles: Role[];
  grantKeys: Set<string>;
}) {
  return (
    <section className="border-b border-[color:var(--color-border-subtle)] px-4 py-3 last:border-b-0">
      <h3 className="px-1 pb-2 text-xs font-medium tracking-wide text-[color:var(--color-content-subtle)]">
        {formatPermissionArea(category)}
      </h3>
      <div className="space-y-2">
        {permissions.map((permission) => (
          <div
            key={permission.id}
            className="grid grid-cols-[var(--role-columns)] items-center rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-4 py-3 transition-colors hover:bg-[color:var(--color-bg-muted)]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
                  {permission.name}
                </span>
                <InfoTooltip text={permission.description ?? permission.name} />
              </div>
            </div>
            {roles.map((role) => {
              const enabled = grantKeys.has(`${role.id}:${permission.id}`);
              return (
                <div key={role.id} className="flex justify-center">
                  <RolePermissionToggle
                    roleId={role.id}
                    roleName={role.name}
                    permissionId={permission.id}
                    permissionName={permission.name}
                    initialEnabled={enabled}
                    locked={isLockedRolePermission(role.key, permission.key)}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
