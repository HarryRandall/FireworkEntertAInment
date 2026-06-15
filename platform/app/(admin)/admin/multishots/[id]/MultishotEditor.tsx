'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  deleteMultishotShot,
  updateMultishot,
  upsertMultishotShot,
} from '@/app/actions/admin-multishots';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { Field, FieldError, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { toast } from '@/app/components/ui/toast';
import type {
  AdminMultishotDetail,
  AdminMultishotFireworkOption,
  AdminMultishotShot,
} from '@/lib/admin.types';

const LAUNCH_POSITION_OPTIONS = [
  { value: '0', label: 'Position 1' },
  { value: '1', label: 'Position 2' },
  { value: '2', label: 'Position 3' },
];

type ShotDraft = {
  id?: string;
  fireworkId: string;
  sequenceIndex: string;
  timeOffsetSeconds: string;
  panDegrees: string;
  tiltDegrees: string;
  launchPositionIndex: string;
  notes: string;
};

function swatch(color: string | null) {
  if (!color) return null;
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-[color:var(--color-border-subtle)]"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function shotToDraft(shot: AdminMultishotShot): ShotDraft {
  return {
    id: shot.id,
    fireworkId: shot.fireworkId ?? '',
    sequenceIndex: String(shot.sequenceIndex),
    timeOffsetSeconds: String(shot.timeOffsetSeconds),
    panDegrees: String(shot.panDegrees),
    tiltDegrees: String(shot.tiltDegrees),
    launchPositionIndex: String(shot.launchPositionIndex),
    notes: shot.notes ?? '',
  };
}

export function MultishotEditor({ multishot }: { multishot: AdminMultishotDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(multishot.name);
  const [description, setDescription] = useState(multishot.description ?? '');
  const [durationSeconds, setDurationSeconds] = useState(
    multishot.durationSeconds == null ? '' : String(multishot.durationSeconds),
  );

  const fireworkOptions = multishot.fireworkOptions.map((firework) => ({
    value: firework.id,
    label: firework.name,
    description: firework.effectName ?? undefined,
  }));

  const nextSequenceIndex = multishot.shots.length
    ? Math.max(...multishot.shots.map((shot) => shot.sequenceIndex)) + 1
    : 1;

  function saveMeta() {
    setError(null);
    startTransition(async () => {
      const result = await updateMultishot({
        id: multishot.id,
        name,
        description,
        durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Multishot saved');
      router.refresh();
    });
  }

  return (
    <div className="grid min-h-0 gap-8 xl:grid-cols-[minmax(0,380px)_1fr]">
      <section className="space-y-5 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-5">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
            Multishot
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
            Place existing fireworks on a timeline. A multishot never changes how a firework looks.
          </p>
        </div>

        {error ? (
          <InlineAlert tone="danger" title="Could not save">
            {error}
          </InlineAlert>
        ) : null}

        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="ms-name">Name</FieldLabel>
            <Input id="ms-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ms-duration">Duration seconds</FieldLabel>
            <Input
              id="ms-duration"
              inputMode="decimal"
              value={durationSeconds}
              onChange={(event) => setDurationSeconds(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ms-description">Description</FieldLabel>
            <Textarea
              id="ms-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>

        <Button onClick={saveMeta} loading={isPending} className="w-full">
          <Save size={16} />
          Save multishot
        </Button>
      </section>

      <section className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
              Shot sequence
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
              Choose a firework, when it fires, and where it is aimed.
            </p>
          </div>
          <Badge tone="accent" solid>
            {multishot.shots.length} shots
          </Badge>
        </div>

        {fireworkOptions.length === 0 ? (
          <InlineAlert tone="info" title="No fireworks yet">
            Create a firework first, then come back to place it in this multishot.
          </InlineAlert>
        ) : (
          <DataTableShell viewport>
            <table className={tableClasses('min-w-[1100px]')}>
              <thead className={tableHeadClasses()}>
                <tr>
                  <th className={tableHeaderCellClasses()}>#</th>
                  <th className={tableHeaderCellClasses()}>Firework</th>
                  <th className={tableHeaderCellClasses()}>Time</th>
                  <th className={tableHeaderCellClasses()}>Pan</th>
                  <th className={tableHeaderCellClasses()}>Tilt</th>
                  <th className={tableHeaderCellClasses()}>Position</th>
                  <th className={tableHeaderCellClasses()}>Notes</th>
                  <th className={tableHeaderCellClasses('text-right')}>Save</th>
                </tr>
              </thead>
              <tbody>
                {multishot.shots.map((shot) => (
                  <ShotRowEditor
                    key={shot.id}
                    multishotId={multishot.id}
                    initial={shotToDraft(shot)}
                    fireworkOptions={fireworkOptions}
                    fireworks={multishot.fireworkOptions}
                  />
                ))}
                <ShotRowEditor
                  multishotId={multishot.id}
                  initial={{
                    fireworkId: multishot.fireworkOptions[0]?.id ?? '',
                    sequenceIndex: String(nextSequenceIndex),
                    timeOffsetSeconds: '0',
                    panDegrees: '0',
                    tiltDegrees: '0',
                    launchPositionIndex: '0',
                    notes: '',
                  }}
                  fireworkOptions={fireworkOptions}
                  fireworks={multishot.fireworkOptions}
                  isNew
                />
              </tbody>
            </table>
          </DataTableShell>
        )}
      </section>
    </div>
  );
}

function ShotRowEditor({
  multishotId,
  initial,
  fireworkOptions,
  fireworks,
  isNew = false,
}: {
  multishotId: string;
  initial: ShotDraft;
  fireworkOptions: { value: string; label: string; description?: string }[];
  fireworks: AdminMultishotFireworkOption[];
  isNew?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const selectedFirework = fireworks.find((firework) => firework.id === draft.fireworkId);

  function saveShot() {
    setError(null);
    startTransition(async () => {
      const result = await upsertMultishotShot({
        id: draft.id,
        multishotId,
        fireworkId: draft.fireworkId,
        sequenceIndex: Number(draft.sequenceIndex),
        timeOffsetSeconds: Number(draft.timeOffsetSeconds),
        panDegrees: Number(draft.panDegrees),
        tiltDegrees: Number(draft.tiltDegrees),
        launchPositionIndex: Number(draft.launchPositionIndex),
        notes: draft.notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isNew ? 'Shot added' : 'Shot saved');
      router.refresh();
    });
  }

  function removeShot() {
    if (!draft.id) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMultishotShot({ id: draft.id!, multishotId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Shot removed');
      router.refresh();
    });
  }

  return (
    <tr className={tableRowClasses()}>
      <td className={tableCellClasses('align-top')}>
        <Input
          aria-label="Sequence index"
          className="w-16 font-mono tabular-nums"
          inputMode="numeric"
          value={draft.sequenceIndex}
          onChange={(event) => setDraft((next) => ({ ...next, sequenceIndex: event.target.value }))}
        />
      </td>
      <td className={tableCellClasses('align-top')}>
        <div className="min-w-64 space-y-2">
          <SelectField
            ariaLabel="Firework"
            value={draft.fireworkId}
            onChange={(value) => setDraft((next) => ({ ...next, fireworkId: value }))}
            options={fireworkOptions}
            disabled={fireworkOptions.length === 0}
          />
          <div className="flex items-center gap-2 text-xs text-[color:var(--color-content-subtle)]">
            {swatch(selectedFirework?.primaryColor ?? null)}
            <span>{selectedFirework?.effectName ?? 'No firework selected'}</span>
          </div>
          <FieldError>{error}</FieldError>
        </div>
      </td>
      <td className={tableCellClasses('align-top')}>
        <Input
          aria-label="Time offset seconds"
          className="w-24 font-mono tabular-nums"
          inputMode="decimal"
          value={draft.timeOffsetSeconds}
          onChange={(event) =>
            setDraft((next) => ({ ...next, timeOffsetSeconds: event.target.value }))
          }
        />
      </td>
      <td className={tableCellClasses('align-top')}>
        <Input
          aria-label="Pan degrees"
          className="w-20 font-mono tabular-nums"
          inputMode="numeric"
          value={draft.panDegrees}
          onChange={(event) => setDraft((next) => ({ ...next, panDegrees: event.target.value }))}
        />
      </td>
      <td className={tableCellClasses('align-top')}>
        <Input
          aria-label="Tilt degrees"
          className="w-20 font-mono tabular-nums"
          inputMode="numeric"
          value={draft.tiltDegrees}
          onChange={(event) => setDraft((next) => ({ ...next, tiltDegrees: event.target.value }))}
        />
      </td>
      <td className={tableCellClasses('align-top')}>
        <div className="w-32">
          <SelectField
            ariaLabel="Launch position"
            value={draft.launchPositionIndex}
            onChange={(value) => setDraft((next) => ({ ...next, launchPositionIndex: value }))}
            options={LAUNCH_POSITION_OPTIONS}
          />
        </div>
      </td>
      <td className={tableCellClasses('align-top')}>
        <div className="min-w-48">
          <Input
            aria-label="Shot notes"
            value={draft.notes}
            onChange={(event) => setDraft((next) => ({ ...next, notes: event.target.value }))}
          />
        </div>
      </td>
      <td className={tableCellClasses('text-right align-top')}>
        <div className="flex justify-end gap-2">
          <Button
            size="icon"
            variant={isNew ? 'accent' : 'secondary'}
            loading={isPending}
            onClick={saveShot}
            aria-label={isNew ? 'Add shot' : 'Save shot'}
            disabled={!draft.fireworkId}
          >
            {isNew ? <Plus size={16} /> : <Save size={16} />}
          </Button>
          {!isNew ? (
            <Button
              size="icon"
              variant="destructive"
              loading={isPending}
              onClick={removeShot}
              aria-label="Delete shot"
            >
              <Trash2 size={16} />
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
