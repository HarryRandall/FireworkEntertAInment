'use client';

/** Row UI for toggling a single RBAC permission override on a user. */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { setUserPermissionOverrideAction } from '@/app/(admin)/admin/users/actions';
import { toast } from '@/ui/patterns/toast';

type Mode = 'clear' | 'grant' | 'deny';

type Props = {
  userId: string;
  permission: { id: string; key: string; name: string; description: string | null };
  initialMode: Mode;
};

const MODES: { value: Mode; label: string }[] = [
  { value: 'clear', label: 'Inherit' },
  { value: 'grant', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
];

export function PermissionOverrideRow({ userId, permission, initialMode }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [isPending, startTransition] = useTransition();

  const onChange = (next: Mode) => {
    if (next === mode || isPending) return;
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await setUserPermissionOverrideAction({
        userId,
        permissionId: permission.id,
        mode: next,
      });
      if (result.ok) {
        toast.success(
          `${permission.name}: ${next === 'clear' ? 'inherited' : next === 'grant' ? 'allowed' : 'denied'}`,
        );
        router.refresh();
      } else {
        setMode(previous);
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="border-border flex items-start justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-sm font-medium">{permission.name}</div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          <span className="font-mono">{permission.key}</span>
          {permission.description ? <span className="ml-2">{permission.description}</span> : null}
        </div>
      </div>
      <div
        role="radiogroup"
        className="border-border bg-card inline-flex shrink-0 rounded-md border p-0.5"
      >
        {MODES.map((m) => {
          const selected = m.value === mode;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={isPending}
              onClick={() => onChange(m.value)}
              className={cn(
                'h-7 rounded px-3 text-xs font-medium transition-colors',
                selected
                  ? m.value === 'grant'
                    ? 'bg-status-success-subtle text-status-success'
                    : m.value === 'deny'
                      ? 'bg-status-danger-subtle text-status-danger'
                      : 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
