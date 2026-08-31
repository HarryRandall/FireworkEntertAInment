'use client';

/** Client-owned permission exception list for immediate add/update feedback. */

import { useEffect, useState } from 'react';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';
import {
  AddPermissionOverrideDialog,
  type PermissionOverrideOption,
} from './AddPermissionOverrideDialog';
import { PermissionExceptionRow } from './PermissionExceptionRow';

type Mode = 'grant' | 'deny';
type PermissionExceptionPermission = Omit<PermissionOverrideOption, 'inheritedAllowed'>;

export type PermissionExceptionState = {
  permission: PermissionExceptionPermission;
  inheritedAllowed: boolean;
  mode: Mode;
};

type Props = {
  userId: string;
  roleName: string;
  initialExceptions: PermissionExceptionState[];
  initialAddOptions: PermissionOverrideOption[];
};

function sortPermissions(a: PermissionOverrideOption, b: PermissionOverrideOption) {
  return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
}

export function PermissionExceptionsPanel({
  userId,
  roleName,
  initialExceptions,
  initialAddOptions,
}: Props) {
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [addOptions, setAddOptions] = useState(initialAddOptions);

  useEffect(() => {
    setExceptions(initialExceptions);
    setAddOptions(initialAddOptions);
  }, [initialAddOptions, initialExceptions]);

  const addException = (exception: PermissionExceptionState) => {
    setExceptions((current) => {
      const exists = current.some((item) => item.permission.id === exception.permission.id);
      if (exists) {
        return current.map((item) =>
          item.permission.id === exception.permission.id ? exception : item,
        );
      }
      return [...current, exception];
    });
    setAddOptions((current) =>
      current.filter((permission) => permission.id !== exception.permission.id),
    );
  };

  const rollbackAddedExceptions = (exceptionsToRollback: PermissionExceptionState[]) => {
    const rollbackIds = new Set(exceptionsToRollback.map((exception) => exception.permission.id));
    setExceptions((current) => current.filter((item) => !rollbackIds.has(item.permission.id)));
    setAddOptions((current) => {
      const existing = new Set(current.map((permission) => permission.id));
      const restored = exceptionsToRollback.flatMap((exception) =>
        existing.has(exception.permission.id)
          ? []
          : [{ ...exception.permission, inheritedAllowed: exception.inheritedAllowed }],
      );
      return [...current, ...restored].sort(sortPermissions);
    });
  };

  const updateException = (permissionId: string, mode: Mode) => {
    setExceptions((current) =>
      current.map((item) => (item.permission.id === permissionId ? { ...item, mode } : item)),
    );
  };

  const clearException = (exception: PermissionExceptionState) => {
    setExceptions((current) =>
      current.filter((item) => item.permission.id !== exception.permission.id),
    );
    setAddOptions((current) => {
      const exists = current.some((permission) => permission.id === exception.permission.id);
      if (exists) return current;
      return [
        ...current,
        { ...exception.permission, inheritedAllowed: exception.inheritedAllowed },
      ].sort(sortPermissions);
    });
  };

  const restoreException = (exception: PermissionExceptionState) => {
    setExceptions((current) => {
      const exists = current.some((item) => item.permission.id === exception.permission.id);
      if (exists) return current;
      return [...current, exception];
    });
    setAddOptions((current) =>
      current.filter((permission) => permission.id !== exception.permission.id),
    );
  };

  return (
    <Card elevation="low" radius="lg" className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
            Permission exceptions
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-[color:var(--color-content-subtle)]">
            Permission overrides are listed only when customised for this user. Defaults come from
            the selected role.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button href="/admin/roles" variant="ghost" size="sm">
            Role defaults
          </Button>
          <AddPermissionOverrideDialog
            userId={userId}
            permissions={addOptions}
            onSaved={addException}
            onFailed={rollbackAddedExceptions}
          />
        </div>
      </div>
      {exceptions.length > 0 ? (
        <div className="divide-y divide-[color:var(--color-border-subtle)]">
          {exceptions.map((exception) => (
            <PermissionExceptionRow
              key={exception.permission.id}
              userId={userId}
              permission={exception.permission}
              inheritedAllowed={exception.inheritedAllowed}
              initialMode={exception.mode}
              onModeChange={(mode) => updateException(exception.permission.id, mode)}
              onCleared={() => clearException(exception)}
              onClearFailed={() => restoreException(exception)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--color-content-subtle)]">
          No custom permissions. This user inherits the {roleName} role defaults.
        </p>
      )}
    </Card>
  );
}
