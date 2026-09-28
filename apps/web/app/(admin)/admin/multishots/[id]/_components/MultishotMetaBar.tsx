/** Multishot name, duration and save-state bar. */
'use client';

import { Check, Loader2, Pencil, Save, TriangleAlert } from 'lucide-react';
import { Badge } from '@/ui/patterns/Badge';
import { Button } from '@/ui/patterns/Button';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { Input, Textarea } from '@/ui/patterns/Input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/primitives/dialog';
import {
  MULTISHOT_DESCRIPTION_MAX_LENGTH,
  MULTISHOT_MAX_DURATION_SECONDS,
  MULTISHOT_NAME_MAX_LENGTH,
} from '@/lib/admin/multishot-constraints';
import { SaveState } from './multishot-model';

export function MetaBar({
  open,
  dirty,
  name,
  description,
  durationSeconds,
  saving,
  error,
  shotCount,
  onOpenChange,
  onName,
  onDescription,
  onDuration,
  onSave,
}: {
  open: boolean;
  dirty: boolean;
  name: string;
  description: string;
  durationSeconds: string;
  saving: boolean;
  error: string | null;
  shotCount: number;
  onOpenChange: (open: boolean) => void;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
  onDuration: (value: string) => void;
  onSave: () => void;
}) {
  const durationLabel = durationSeconds.trim() ? `${durationSeconds.trim()}s` : 'Auto duration';

  return (
    <section className="border-border bg-card rounded-lg border px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-foreground truncate text-sm font-semibold">
              {name || 'Untitled multishot'}
            </h1>
            <Badge tone="neutral" solid icon={null} className="font-mono tabular-nums">
              {durationLabel}
            </Badge>
            <Badge tone="accent" solid>
              {shotCount} {shotCount === 1 ? 'shot' : 'shots'}
            </Badge>
            {dirty ? (
              <Badge tone="warning" solid icon={null}>
                Unsaved edits
              </Badge>
            ) : null}
          </div>
          {description ? (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <Pencil size={14} />
                Edit details
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit multishot details</DialogTitle>
              </DialogHeader>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSave();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <Field>
                    <FieldLabel htmlFor="ms-name">Name</FieldLabel>
                    <Input
                      id="ms-name"
                      required
                      maxLength={MULTISHOT_NAME_MAX_LENGTH}
                      value={name}
                      onChange={(event) => onName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ms-duration">Duration (s)</FieldLabel>
                    <Input
                      id="ms-duration"
                      inputMode="decimal"
                      min={0}
                      max={MULTISHOT_MAX_DURATION_SECONDS}
                      step="0.01"
                      className="font-mono tabular-nums"
                      value={durationSeconds}
                      onChange={(event) => onDuration(event.target.value)}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="ms-description">Description</FieldLabel>
                  <Textarea
                    id="ms-description"
                    rows={5}
                    maxLength={MULTISHOT_DESCRIPTION_MAX_LENGTH}
                    value={description}
                    onChange={(event) => onDescription(event.target.value)}
                  />
                </Field>
                {error ? (
                  <InlineAlert tone="danger" title="Could not save">
                    {error}
                  </InlineAlert>
                ) : null}
                <DialogFooter>
                  <Button type="submit" loading={saving}>
                    <Save size={16} />
                    Save details
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <Loader2 size={12} className="animate-spin" />
        Saving
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <Check size={12} />
        Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="text-status-danger flex items-center gap-1 text-xs">
        <TriangleAlert size={12} />
        Not saved
      </span>
    );
  }
  return null;
}
