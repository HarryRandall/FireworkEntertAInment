'use client';

/** Row UI for one explicit user permission override. */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleDashed, X } from 'lucide-react';
import { setUserPermissionOverrideAction } from '@/app/(admin)/admin/users/actions';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { toast } from '@/ui/patterns/toast';
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
    <div className="border-border flex flex-col gap-3 border-b py-3 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-foreground text-sm font-medium">{permission.name}</span>
          <InfoTooltip text={permission.description ?? permission.name} />
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label={`Override ${permission.name}`}
        className="border-border bg-card inline-flex w-fit rounded-md border p-0.5"
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
                'focus-visible:outline-foreground inline-flex h-8 cursor-pointer items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70',
                selected
                  ? choice.value === 'grant'
                    ? 'bg-status-success-subtle text-status-success'
                    : 'bg-status-danger-subtle text-status-danger'
                  : choice.value === 'clear'
                    ? inheritedAllowed
                      ? 'text-status-success hover:bg-status-success-subtle'
                      : 'text-status-danger hover:bg-status-danger-subtle'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
