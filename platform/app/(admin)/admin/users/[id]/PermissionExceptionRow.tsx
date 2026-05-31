'use client';

/** Row UI for one explicit user permission override. */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleDashed, X } from 'lucide-react';
import { setUserPermissionOverrideAction } from '@/app/actions/admin-users';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { toast } from '@/app/components/ui/toast';
import { cn } from '@/lib/utils';

type Mode = 'grant' | 'deny';
type Choice = 'clear' | Mode;

type Permission = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
};

type Props = {
  userId: string;
  permission: Permission;
  inheritedAllowed: boolean;
  initialMode: Mode;
  onModeChange?: (mode: Mode) => void;
  onCleared?: () => void;
  onClearFailed?: () => void;
};

const CHOICES: { value: Choice; label: string; icon: typeof CircleDashed }[] = [
  { value: 'clear', label: 'Default', icon: CircleDashed },
  { value: 'grant', label: 'On', icon: Check },
  { value: 'deny', label: 'Off', icon: X },
];

export function PermissionExceptionRow({
  userId,
  permission,
  inheritedAllowed,
  initialMode,
  onModeChange,
  onCleared,
  onClearFailed,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const updateMode = (next: Mode | 'clear') => {
    if ((next !== 'clear' && next === mode) || isPending) return;
    const previous = mode;
    if (next === 'clear') {
      onCleared?.();
    } else {
      setMode(next);
      onModeChange?.(next);
    }
    const toastId = toast.loading(
      next === 'clear' ? 'Clearing permission override...' : 'Saving permission override...',
    );
    startTransition(async () => {
      const result = await setUserPermissionOverrideAction({
        userId,
        permissionId: permission.id,
        mode: next,
      });
      if (result.ok) {
        toast.success(
          `${permission.name}: ${next === 'clear' ? 'override cleared' : next === 'grant' ? 'allowed' : 'denied'}`,
          { id: toastId },
        );
        router.refresh();
      } else {
        setMode(previous);
        if (next === 'clear') {
          onClearFailed?.();
        } else {
          onModeChange?.(previous);
        }
        toast.error(result.error, { id: toastId });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 border-b border-[color:var(--color-border-subtle)] py-3 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
            {permission.name}
          </span>
          <InfoTooltip text={permission.description ?? permission.name} />
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label={`Override ${permission.name}`}
        className="inline-flex w-fit rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-0.5"
      >
        {CHOICES.map((choice) => {
          const Icon = choice.icon;
          const selected = choice.value === mode;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={
                choice.value === 'clear'
                  ? `Default ${inheritedAllowed ? 'on' : 'off'}`
                  : choice.label
              }
              disabled={isPending}
              onClick={() => updateMode(choice.value)}
              className={cn(
                'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)] disabled:cursor-wait disabled:opacity-70',
                selected
                  ? choice.value === 'grant'
                    ? 'bg-[color:var(--color-status-success-subtle)] text-[color:var(--color-status-success)]'
                    : 'bg-[color:var(--color-status-danger-subtle)] text-[color:var(--color-status-danger)]'
                  : choice.value === 'clear'
                    ? inheritedAllowed
                      ? 'text-[color:var(--color-status-success)] hover:bg-[color:var(--color-status-success-subtle)]'
                      : 'text-[color:var(--color-status-danger)] hover:bg-[color:var(--color-status-danger-subtle)]'
                    : 'text-[color:var(--color-content-subtle)] hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)]',
              )}
            >
              <Icon size={13} />
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
