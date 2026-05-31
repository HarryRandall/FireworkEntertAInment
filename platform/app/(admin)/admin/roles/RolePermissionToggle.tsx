'use client';

/** Autosaving role permission toggle used by the role-default matrix. */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LockKeyhole, X } from 'lucide-react';
import { setRolePermissionAction } from '@/app/actions/admin-roles';
import { toast } from '@/app/components/ui/toast';
import { cn } from '@/lib/utils';

type Props = {
  roleId: string;
  roleName: string;
  permissionId: string;
  permissionName: string;
  initialEnabled: boolean;
  locked?: boolean;
};

export function RolePermissionToggle({
  roleId,
  roleName,
  permissionId,
  permissionName,
  initialEnabled,
  locked = false,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const onToggle = () => {
    if (locked || isPending) return;
    const next = !enabled;
    const previous = enabled;
    const toastId = toast.loading(
      `${next ? 'Enabling' : 'Disabling'} ${permissionName} for ${roleName}...`,
    );
    setEnabled(next);
    startTransition(async () => {
      const result = await setRolePermissionAction({
        roleId,
        permissionId,
        enabled: next,
      });
      if (result.ok) {
        toast.success(`${roleName}: ${permissionName} ${next ? 'enabled' : 'disabled'}.`, {
          id: toastId,
        });
        router.refresh();
      } else {
        setEnabled(previous);
        toast.error(result.error, { id: toastId });
      }
    });
  };

  if (locked) {
    return (
      <span className="inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-subtle)] px-3 text-xs font-medium text-[color:var(--color-content-emphasis)]">
        <LockKeyhole size={13} />
        Required
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? 'Disable' : 'Enable'} ${permissionName} for ${roleName}`}
      disabled={isPending}
      onClick={onToggle}
      className={cn(
        'group relative inline-flex h-8 min-w-24 cursor-pointer items-center justify-center overflow-hidden rounded-md border px-3 text-xs font-medium transition-all duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)] disabled:cursor-wait disabled:opacity-70',
        enabled
          ? 'border-transparent bg-[color-mix(in_srgb,var(--color-status-success)_18%,transparent)] text-[color:var(--color-status-success)] hover:bg-[color-mix(in_srgb,var(--color-status-danger)_18%,transparent)] hover:text-[color:var(--color-status-danger)] hover:ring-2 hover:ring-[color-mix(in_srgb,var(--color-status-danger)_12%,transparent)]'
          : 'border-transparent bg-[color-mix(in_srgb,var(--color-status-danger)_16%,transparent)] text-[color:var(--color-status-danger)] hover:bg-[color-mix(in_srgb,var(--color-status-success)_18%,transparent)] hover:text-[color:var(--color-status-success)] hover:ring-2 hover:ring-[color-mix(in_srgb,var(--color-status-success)_12%,transparent)]',
      )}
    >
      <span className="flex items-center gap-1.5 transition-all duration-150 group-hover:-translate-y-3 group-hover:opacity-0">
        {enabled ? <Check size={13} /> : <X size={13} />}
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
      <span className="absolute inset-0 flex translate-y-3 items-center justify-center gap-1.5 opacity-0 backdrop-blur-sm transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        {enabled ? <X size={13} /> : <Check size={13} />}
        {enabled ? 'Disable' : 'Enable'}
      </span>
    </button>
  );
}
