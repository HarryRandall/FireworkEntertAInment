'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, FileInput, ImageIcon, Loader2, Plus } from 'lucide-react';
import {
  createShowPreset,
  duplicateShowPreset,
  importAllGeneratedShowsAsPresets,
  importGeneratedShowAsPreset,
} from '@/app/actions/admin-show-presets';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { Input } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { toast } from '@/app/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { AdminShowPresetImportShow } from '@/lib/admin.types';
import { formatBudget, formatDuration } from '@/lib/show-domain';

export function ShowPresetCreateActions({
  importableShows,
}: {
  importableShows: AdminShowPresetImportShow[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button href="/admin/cover-posters" variant="secondary">
        <ImageIcon size={16} /> Cover posters
      </Button>
      <ImportAllShowPresetsButton disabled={importableShows.length === 0} />
      <ImportShowPresetButton importableShows={importableShows} />
      <NewShowPresetButton />
    </div>
  );
}

function NewShowPresetButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createShowPreset({ title: title.trim() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Draft show created');
      setOpen(false);
      setTitle('');
      router.push(`/admin/show-presets/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> New draft
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New curated show</DialogTitle>
          <DialogDescription>
            Create a draft, then add catalogue items and publish it when it is ready.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="new-show-preset-title">Title</FieldLabel>
          <Input
            id="new-show-preset-title"
            value={title}
            placeholder="Harbour Finale"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button onClick={create} loading={isPending} disabled={!title.trim()}>
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportShowPresetButton({
  importableShows,
}: {
  importableShows: AdminShowPresetImportShow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showId, setShowId] = useState(importableShows[0]?.id ?? '');
  const [isPending, startTransition] = useTransition();

  function importShow() {
    if (!showId) return;
    startTransition(async () => {
      const result = await importGeneratedShowAsPreset({ showId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Show imported as draft');
      setOpen(false);
      router.push(`/admin/show-presets/${result.id}`);
    });
  }

  const options = importableShows.map((show) => ({
    value: show.id,
    label: show.title,
    description: [
      formatDuration(show.durationSeconds),
      `${show.effectsCount} cues`,
      formatBudget(show.totalCents),
      show.ownerEmail,
    ]
      .filter(Boolean)
      .join(' - '),
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={importableShows.length === 0}>
          <FileInput size={16} /> Import show
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import generated show</DialogTitle>
          <DialogDescription>
            Copy a completed generated show into a draft curated Explore show.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Generated show</FieldLabel>
          <SelectField value={showId} options={options} onChange={setShowId} />
        </Field>
        <DialogFooter>
          <Button onClick={importShow} loading={isPending} disabled={!showId}>
            Import draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportAllShowPresetsButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function importAll() {
    startTransition(async () => {
      const result = await importAllGeneratedShowsAsPresets();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const skipped =
        result.skippedCount > 0 ? `, skipped ${result.skippedCount} already imported` : '';
      toast.success(
        `Imported ${result.importedCount} show${result.importedCount === 1 ? '' : 's'} as drafts${skipped}`,
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          <FileInput size={16} /> Import all shows
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import all generated shows</DialogTitle>
          <DialogDescription>
            Copy every completed generated show into unpublished curated drafts.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={importAll} loading={isPending}>
            Import all drafts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DuplicateShowPresetButton({ presetId }: { presetId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateShowPreset({ id: presetId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Preset duplicated');
      router.push(`/admin/show-presets/${result.id}`);
    });
  }

  return (
    <button
      type="button"
      onClick={duplicate}
      disabled={isPending}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)] disabled:cursor-wait disabled:opacity-60"
      aria-label="Duplicate preset"
      title="Duplicate preset"
    >
      {isPending ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
    </button>
  );
}
