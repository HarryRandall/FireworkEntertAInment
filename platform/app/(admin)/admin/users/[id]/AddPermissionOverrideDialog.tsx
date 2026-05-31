'use client';

/** Dialog for adding one or more user-level permission overrides. */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleDashed, Plus, Search, X } from 'lucide-react';
import { setUserPermissionOverrideAction } from '@/app/actions/admin-users';
import { Button } from '@/app/components/ui/Button';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { Input } from '@/app/components/ui/Input';
import { toast } from '@/app/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Mode = 'grant' | 'deny';
type Choice = 'default' | Mode;

export type PermissionOverrideOption = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  inheritedAllowed: boolean;
};

type Props = {
  userId: string;
  permissions: PermissionOverrideOption[];
  onSaved?: (exception: {
    permission: PermissionOverrideOption;
    inheritedAllowed: boolean;
    mode: Mode;
  }) => void;
  onFailed?: (
    exceptions: {
      permission: PermissionOverrideOption;
      inheritedAllowed: boolean;
      mode: Mode;
    }[],
  ) => void;
};

const CHOICES: { value: Choice; label: string; icon: typeof CircleDashed }[] = [
  { value: 'default', label: 'Default', icon: CircleDashed },
  { value: 'grant', label: 'On', icon: Check },
  { value: 'deny', label: 'Off', icon: X },
];

export function AddPermissionOverrideDialog({ userId, permissions, onSaved, onFailed }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [choices, setChoices] = useState<Record<string, Mode>>({});
  const [isPending, startTransition] = useTransition();

  const filteredPermissions = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (!normalised) return permissions;
    return permissions.filter((permission) =>
      [permission.name, permission.key, permission.description, permission.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalised),
    );
  }, [permissions, query]);

  const selectedOverrides = Object.entries(choices).flatMap(([permissionId, mode]) => {
    const permission = permissions.find((item) => item.id === permissionId);
    return permission ? [{ permission, mode }] : [];
  });

  const reset = () => {
    setQuery('');
    setChoices({});
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const selectChoice = (permission: PermissionOverrideOption, next: Choice) => {
    if (next === 'default') {
      setChoices((current) => {
        const { [permission.id]: _removed, ...rest } = current;
        void _removed;
        return rest;
      });
      return;
    }
    setChoices((current) => ({ ...current, [permission.id]: next }));
  };

  const save = () => {
    if (selectedOverrides.length === 0 || isPending) return;
    const overrides = selectedOverrides.map((override) => ({
      permission: override.permission,
      inheritedAllowed: override.permission.inheritedAllowed,
      mode: override.mode,
    }));
    for (const override of overrides) onSaved?.(override);

    const toastId = toast.loading(
      overrides.length === 1 ? 'Saving permission override...' : 'Saving permission overrides...',
    );
    setOpen(false);
    reset();
    startTransition(async () => {
      const results = await Promise.all(
        overrides.map(async (override) => ({
          override,
          result: await setUserPermissionOverrideAction({
            userId,
            permissionId: override.permission.id,
            mode: override.mode,
          }),
        })),
      );
      const failed = results.filter(({ result }) => !result.ok);

      if (failed.length > 0) {
        onFailed?.(failed.map(({ override }) => override));
        const firstFailed = failed[0];
        const firstError = firstFailed?.result.ok === false ? firstFailed.result.error : null;
        toast.error(
          failed.length === 1
            ? (firstError ?? 'Permission override failed.')
            : `${failed.length} permission overrides failed.${firstError ? ` ${firstError}` : ''}`,
          { id: toastId },
        );
        router.refresh();
        return;
      }

      toast.success(
        overrides.length === 1
          ? 'Override saved.'
          : `${overrides.length} permission overrides saved.`,
        { id: toastId },
      );
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="md">
          <Plus size={14} />
          Add override
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] !gap-0 overflow-hidden border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-0 text-[color:var(--color-content-emphasis)] sm:max-w-[680px]">
        <DialogHeader className="border-b border-[color:var(--color-border-subtle)] px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">Add permission override</DialogTitle>
          <DialogDescription className="max-w-lg text-sm text-[color:var(--color-content-subtle)]">
            Add one exception to this user's role defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-6 py-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            iconLeft={<Search size={16} />}
            placeholder="Search permissions…"
            aria-label="Search permissions"
            className="h-10 text-sm"
          />

          <div className="max-h-[min(320px,calc(100dvh-21rem))] min-h-44 overflow-y-auto rounded-lg border border-[color:var(--color-border-subtle)]">
            {filteredPermissions.length > 0 ? (
              filteredPermissions.map((permission) => {
                const selectedMode = choices[permission.id];
                const selected = selectedMode != null;
                return (
                  <div
                    key={permission.id}
                    className={cn(
                      'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 text-left transition-colors last:border-b-0',
                      selected
                        ? 'bg-[color:var(--color-accent-subtle)] ring-1 ring-[color:var(--color-accent)] ring-inset'
                        : 'hover:bg-[color:var(--color-bg-muted)]',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-[color:var(--color-content-emphasis)]">
                          {permission.name}
                        </span>
                        <InfoTooltip text={permission.description ?? permission.name} />
                      </span>
                    </span>
                    <span
                      role="radiogroup"
                      aria-label={`Override ${permission.name}`}
                      className="inline-flex shrink-0 rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-0.5"
                    >
                      {CHOICES.map((choice) => {
                        const Icon = choice.icon;
                        const choiceSelected = selected
                          ? selectedMode === choice.value
                          : choice.value === 'default';
                        return (
                          <button
                            key={choice.value}
                            type="button"
                            role="radio"
                            aria-checked={choiceSelected}
                            aria-label={
                              choice.value === 'default'
                                ? `Default ${permission.inheritedAllowed ? 'on' : 'off'}`
                                : choice.label
                            }
                            onClick={() => selectChoice(permission, choice.value)}
                            className={cn(
                              'inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]',
                              choiceSelected
                                ? choice.value === 'grant'
                                  ? 'bg-[color:var(--color-status-success-subtle)] text-[color:var(--color-status-success)]'
                                  : choice.value === 'deny'
                                    ? 'bg-[color:var(--color-status-danger-subtle)] text-[color:var(--color-status-danger)]'
                                    : permission.inheritedAllowed
                                      ? 'bg-[color:var(--color-status-success-subtle)] text-[color:var(--color-status-success)]'
                                      : 'bg-[color:var(--color-status-danger-subtle)] text-[color:var(--color-status-danger)]'
                                : choice.value === 'default'
                                  ? permission.inheritedAllowed
                                    ? 'text-[color:var(--color-status-success)] hover:bg-[color:var(--color-status-success-subtle)]'
                                    : 'text-[color:var(--color-status-danger)] hover:bg-[color:var(--color-status-danger-subtle)]'
                                  : 'text-[color:var(--color-content-subtle)] hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)]',
                            )}
                          >
                            <Icon size={12} />
                            {choice.label}
                          </button>
                        );
                      })}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-sm text-[color:var(--color-content-subtle)]">
                No available permissions match the current search.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-[color:var(--color-border-subtle)] px-6 pt-4 pb-6">
          <Button
            variant="accent"
            size="md"
            className="min-w-40"
            loading={isPending}
            disabled={selectedOverrides.length === 0}
            onClick={save}
          >
            Save {selectedOverrides.length > 1 ? 'overrides' : 'override'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
