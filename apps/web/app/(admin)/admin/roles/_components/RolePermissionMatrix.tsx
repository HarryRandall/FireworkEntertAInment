'use client';

/** Custom permission matrix for editing role-level defaults. */

import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/ui/patterns/Badge';
import { Button } from '@/ui/patterns/Button';
import {
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/ui/patterns/DataTable';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { isLockedRolePermission } from '@/lib/admin/role-permissions';
import type { Permission, Role } from '@/lib/admin.types';
import { cn } from '@/lib/utils';
import { RolePermissionToggle } from '@/app/(admin)/admin/roles/_components/RolePermissionToggle';

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
    <div className="space-y-3">
      {groupedPermissions.map(([category, permissions], index) => (
        <RolePermissionGroup
          key={category}
          defaultExpanded={index === 0}
          category={category}
          permissions={permissions}
          roles={roles}
          grantKeys={grantKeys}
        />
      ))}
      {groupedPermissions.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No permissions match the current filters.
        </p>
      ) : null}
    </div>
  );
}

function RolePermissionGroup({
  defaultExpanded,
  category,
  permissions,
  roles,
  grantKeys,
}: {
  defaultExpanded: boolean;
  category: string;
  permissions: Permission[];
  roles: Role[];
  grantKeys: Set<string>;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();
  const headingId = useId();

  return (
    <section
      className="border-border bg-background overflow-hidden rounded-lg border"
      aria-labelledby={headingId}
    >
      <h2 id={headingId}>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
          className="text-foreground bg-background aria-expanded:bg-background h-auto w-full justify-start rounded-none border-0 px-4 py-4 active:translate-y-0"
        >
          <ChevronRight aria-hidden className={cn('size-4 shrink-0', expanded && 'rotate-90')} />
          {formatPermissionArea(category)}
          <Badge tone="neutral">{permissions.length}</Badge>
        </Button>
      </h2>
      <div id={contentId} hidden={!expanded} className="border-border overflow-x-auto border-t">
        <table className={tableClasses('table-fixed')} aria-labelledby={headingId}>
          <colgroup>
            <col />
            {roles.map((role) => (
              <col key={role.id} className="w-32 lg:w-40" />
            ))}
          </colgroup>
          <thead className={tableHeadClasses()}>
            <tr>
              <th scope="col" className={tableHeaderCellClasses()}>
                Permission
              </th>
              {roles.map((role) => (
                <th key={role.id} scope="col" className={tableHeaderCellClasses('text-center')}>
                  <span className="inline-flex items-center gap-1.5">
                    {role.name}
                    {role.description ? <InfoTooltip text={role.description} /> : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      </div>
    </section>
  );
}
