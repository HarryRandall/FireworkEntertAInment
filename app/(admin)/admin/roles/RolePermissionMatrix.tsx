/** Custom permission matrix for editing role-level defaults. */

import type { CSSProperties } from 'react';
import { Badge } from '@/components/design-system/Badge';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/components/design-system/DataTable';
import { InfoTooltip } from '@/components/design-system/InfoTooltip';
import { isLockedRolePermission } from '@/lib/admin/role-permissions';
import type { Permission, Role } from '@/lib/admin.types';
import { cn } from '@/lib/utils';
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
  const permissionCount = groupedPermissions.reduce(
    (total, [, permissions]) => total + permissions.length,
    0,
  );
  const roleColumnWidth = 148;
  const permissionColumnWidth = 340;
  const tableMinWidth = Math.max(760, permissionColumnWidth + roles.length * roleColumnWidth);
  const roleCountLabel = `${roles.length.toLocaleString()} ${roles.length === 1 ? 'role' : 'roles'}`;
  const permissionCountLabel = `${permissionCount.toLocaleString()} ${
    permissionCount === 1 ? 'permission' : 'permissions'
  }`;

  return (
    <DataTableShell
      viewport
      className="bg-card min-h-[420px] flex-1 lg:max-h-[calc(100dvh-14rem)]"
      footer={
        <div className="text-muted-foreground text-sm">
          Viewing {permissionCountLabel} across {roleCountLabel}
        </div>
      }
    >
      <table className={tableClasses()} style={{ minWidth: `${tableMinWidth}px` } as CSSProperties}>
        <colgroup>
          <col style={{ width: `${permissionColumnWidth}px` }} />
          {roles.map((role) => (
            <col key={role.id} style={{ width: `${roleColumnWidth}px` }} />
          ))}
        </colgroup>
        <thead className={tableHeadClasses()}>
          <tr>
            <th className={tableHeaderCellClasses()}>Permission</th>
            {roles.map((role) => (
              <th key={role.id} className={tableHeaderCellClasses('text-center')}>
                <span className="inline-flex max-w-32 items-center justify-center gap-1.5 align-middle">
                  <span className="truncate">{role.name}</span>
                  {role.description ? <InfoTooltip text={role.description} /> : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
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
            <tr className={tableRowClasses()}>
              <td
                colSpan={Math.max(1, roles.length + 1)}
                className={tableCellClasses(
                  'text-muted-foreground h-24 text-center whitespace-normal',
                )}
              >
                No permissions match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </DataTableShell>
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
    <>
      <tr className={tableRowClasses('bg-muted/45 hover:bg-muted/45')}>
        <th
          scope="rowgroup"
          colSpan={roles.length + 1}
          className={tableCellClasses(
            'text-muted-foreground py-2 text-left font-medium whitespace-normal',
          )}
        >
          <span className="flex items-center gap-2">
            {formatPermissionArea(category)}
            <Badge tone="neutral" className="bg-background/80 rounded-sm">
              {permissions.length.toLocaleString()}
            </Badge>
          </span>
        </th>
      </tr>
      {permissions.map((permission) => (
        <tr key={permission.id} className={tableRowClasses('hover:bg-muted/35')}>
          <th
            scope="row"
            className={cn(
              tableCellClasses('text-left whitespace-normal'),
              'align-middle font-normal',
            )}
          >
            <div className="max-w-md min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-foreground text-sm font-medium">{permission.name}</span>
                <InfoTooltip text={permission.description ?? permission.name} />
              </div>
              {permission.description ? (
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {permission.description}
                </p>
              ) : null}
            </div>
          </th>
          {roles.map((role) => {
            const enabled = grantKeys.has(`${role.id}:${permission.id}`);
            return (
              <td key={role.id} className={tableCellClasses('text-center')}>
                <div className="flex justify-center">
                  <RolePermissionToggle
                    roleId={role.id}
                    roleName={role.name}
                    permissionId={permission.id}
                    permissionName={permission.name}
                    initialEnabled={enabled}
                    locked={isLockedRolePermission(role.key, permission.key)}
                  />
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
