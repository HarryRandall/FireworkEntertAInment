/** Selected-shot inspector: firework picker, timing and launch angles. */
'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Copy, Layers3, MoveHorizontal, MoveVertical, Trash2 } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Input } from '@/ui/patterns/Input';
import { SelectField } from '@/ui/patterns/SelectField';
import { SliderField } from '@/ui/patterns/SliderField';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/primitives/alert-dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover';
import { Slider } from '@/ui/primitives/slider';
import {
  MULTISHOT_MAX_SHOT_COUNT,
  MULTISHOT_PAN_LIMIT_DEGREES,
  MULTISHOT_TILT_LIMIT_DEGREES,
} from '@/lib/admin/multishot-constraints';
import type { FireworkSpecification } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import {
  PAN_PRESETS,
  TILT_PRESETS,
  LocalShot,
  fireworkDurationOf,
  fireworkPaletteOf,
  formatSecondsLabel,
} from './multishot-model';
import { SaveIndicator } from './MultishotMetaBar';

export function Inspector({
  shot,
  fireworkSpecs,
  selectedSpec,
  duration,
  trackCount,
  onChangeFirework,
  onChangeTime,
  onCommitTime,
  onChangePan,
  onChangeTilt,
  onChangeTrack,
  onDuplicate,
  duplicateDisabled,
  onDelete,
}: {
  shot: LocalShot;
  fireworkSpecs: FireworkSpecification[];
  selectedSpec: FireworkSpecification | undefined;
  duration: number;
  trackCount: number;
  onChangeFirework: (fireworkId: string) => void;
  onChangeTime: (seconds: number) => void;
  onCommitTime: (seconds: number) => void;
  onChangePan: (pan: number, options?: { immediate?: boolean }) => void;
  onChangeTilt: (tilt: number, options?: { immediate?: boolean }) => void;
  onChangeTrack: (trackIndex: number) => void;
  onDuplicate: () => void;
  duplicateDisabled: boolean;
  onDelete: () => void;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const trackOptions = Array.from({ length: trackCount }, (_, trackIndex) => ({
    value: String(trackIndex),
    label: `Track ${trackIndex + 1}`,
  }));

  return (
    <aside
      data-preserve-shot-selection
      className="border-border bg-card flex max-h-[560px] min-h-0 flex-col overflow-hidden rounded-lg border"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-3">
        {shot.saveState !== 'idle' ? (
          <div className="flex justify-end">
            <SaveIndicator state={shot.saveState} />
          </div>
        ) : null}
        <Field>
          <FieldLabel>Firework</FieldLabel>
          <FireworkPicker
            value={shot.fireworkId}
            specs={fireworkSpecs}
            onChange={onChangeFirework}
          />
        </Field>

        <FireworkDetails spec={selectedSpec} />

        <Field>
          <FieldLabel>Timeline track</FieldLabel>
          <SelectField
            ariaLabel="Timeline track"
            value={String(shot.timelineTrackIndex)}
            onChange={(value) => onChangeTrack(Number(value))}
            options={trackOptions}
            iconLeft={<Layers3 size={14} />}
          />
        </Field>

        <SliderField
          label="Fires at"
          value={shot.timeOffsetSeconds}
          min={0}
          max={Math.max(1, duration)}
          step={0.1}
          showNumberInput
          formatValue={(value) => `${value.toFixed(1)}s`}
          onChange={onChangeTime}
          onCommit={onCommitTime}
        />

        <div className="space-y-4">
          <AnglePlaneControl
            label="Pan plane"
            icon={<MoveHorizontal size={14} />}
            value={shot.panDegrees}
            min={-MULTISHOT_PAN_LIMIT_DEGREES}
            max={MULTISHOT_PAN_LIMIT_DEGREES}
            presets={PAN_PRESETS}
            hint="Pan is capped at -30° to 30°."
            onChange={onChangePan}
          />
          <AnglePlaneControl
            label="Tilt plane"
            icon={<MoveVertical size={14} />}
            value={shot.tiltDegrees}
            min={-MULTISHOT_TILT_LIMIT_DEGREES}
            max={MULTISHOT_TILT_LIMIT_DEGREES}
            presets={TILT_PRESETS}
            hint="Tilt is capped at -50° to 50°."
            onChange={onChangeTilt}
          />
        </div>
      </div>

      <div className="border-border bg-card grid shrink-0 grid-cols-2 gap-2 border-t p-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onDuplicate}
          disabled={duplicateDisabled}
          title={
            duplicateDisabled
              ? `A multishot can contain up to ${MULTISHOT_MAX_SHOT_COUNT.toLocaleString()} shots.`
              : undefined
          }
          className="min-w-0 px-2"
        >
          <Copy size={14} />
          <span className="truncate">Duplicate</span>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          className="min-w-0 px-2"
        >
          <Trash2 size={14} />
          <span className="truncate">Delete</span>
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="sm" data-preserve-shot-selection>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete shot?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the shot from this multishot. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete shot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

export function AnglePlaneControl({
  label,
  icon,
  value,
  min,
  max,
  presets,
  hint,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: number;
  min: number;
  max: number;
  presets: { value: number; label: string; title: string }[];
  hint: string;
  onChange: (value: number, options?: { immediate?: boolean }) => void;
}) {
  const id = useId();
  const sliderValue = Math.min(max, Math.max(min, value));

  function setNumberValue(next: number, options?: { immediate?: boolean }) {
    if (!Number.isFinite(next)) return;
    const clamped = Math.min(max, Math.max(min, next));
    onChange(Math.round(clamped), options);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-foreground inline-flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <span className="text-muted-foreground">{icon}</span>
          <span className="truncate">{label}</span>
          <InfoTooltip text={hint} />
        </span>
        <span className="bg-secondary text-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums">
          {Math.round(value)}°
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {presets.map((preset) => {
          const active = Math.round(value) === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              title={preset.title}
              aria-pressed={active}
              className={cn(
                'focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border px-1 font-mono text-[11px] font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              onClick={() => onChange(preset.value, { immediate: true })}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Slider
          id={id}
          value={[sliderValue]}
          min={min}
          max={max}
          step={1}
          onValueChange={(next) => onChange(next[0] ?? value)}
          onValueCommit={(next) => onChange(next[0] ?? value, { immediate: true })}
          aria-label={`${label} angle`}
          className="min-w-0 flex-1 py-1 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5"
        />
        <Input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step="any"
          value={value}
          aria-label={`${label} value`}
          className="h-7 w-14 shrink-0 [appearance:textfield] rounded-md px-1.5 text-right font-mono text-xs tabular-nums [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setNumberValue(event.currentTarget.valueAsNumber)}
          onBlur={(event) => {
            setNumberValue(
              event.currentTarget.value === '' ? min : event.currentTarget.valueAsNumber,
              { immediate: true },
            );
          }}
        />
      </div>
    </div>
  );
}

export function FireworkPicker({
  value,
  specs,
  onChange,
}: {
  value: string;
  specs: FireworkSpecification[];
  onChange: (fireworkId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedSpec = specs.find((spec) => spec.id === value);
  const selectedPalette = fireworkPaletteOf(selectedSpec);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-preserve-shot-selection
          aria-label="Firework"
          aria-expanded={open}
          className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-12 w-full items-center gap-2 rounded-md border px-3 py-2 text-left shadow-xs transition-[color,box-shadow] focus:outline-none focus-visible:ring-3"
        >
          <span className="flex shrink-0 -space-x-1" aria-hidden>
            {(selectedPalette.length ? selectedPalette : ['#64748b']).slice(0, 3).map((colour) => (
              <span
                key={colour}
                className="size-4 rounded-full border border-white/35 shadow-sm"
                style={{ backgroundColor: colour }}
              />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {selectedSpec?.name ?? 'Select a firework'}
            </span>
            <span className="text-muted-foreground mt-0.5 block truncate text-xs">
              {selectedSpec?.baseEffect?.name ?? 'No effect information'}
            </span>
          </span>
          <ChevronDown size={15} className="text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-preserve-shot-selection
        align="start"
        className="w-[min(34rem,calc(100vw-2rem))] p-0"
      >
        <Command>
          <CommandInput placeholder="Search name, effect, calibre or description..." />
          <CommandList className="max-h-80">
            <CommandEmpty>No fireworks match that search.</CommandEmpty>
            <CommandGroup>
              {specs.map((spec) => {
                const palette = fireworkPaletteOf(spec);
                const selected = spec.id === value;
                const searchValue = [
                  spec.name,
                  spec.baseEffect?.name,
                  spec.caliber,
                  spec.description,
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <CommandItem
                    key={spec.id}
                    value={searchValue}
                    data-checked={selected}
                    onSelect={() => {
                      onChange(spec.id);
                      setOpen(false);
                    }}
                    className="items-start gap-3 px-3 py-3"
                  >
                    <span className="mt-0.5 flex w-7 shrink-0 flex-wrap gap-0.5" aria-hidden>
                      {(palette.length ? palette : ['#64748b']).slice(0, 4).map((colour) => (
                        <span
                          key={colour}
                          className="size-3 rounded-full border border-white/30"
                          style={{ backgroundColor: colour }}
                        />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{spec.name}</span>
                      <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs">
                        {spec.description || spec.baseEffect?.name || 'No description'}
                      </span>
                      <span className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] tabular-nums">
                        <span>{spec.baseEffect?.name ?? 'Unknown effect'}</span>
                        <span>{formatSecondsLabel(fireworkDurationOf(spec))}</span>
                        <span>{spec.caliber || 'No calibre'}</span>
                        <span>
                          {spec.heightMeters == null ? 'No height' : `${spec.heightMeters} m`}
                        </span>
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function FireworkDetails({ spec }: { spec: FireworkSpecification | undefined }) {
  if (!spec) return null;
  const palette = fireworkPaletteOf(spec);

  return (
    <div className="border-border bg-secondary rounded-md border p-3">
      <p className="text-muted-foreground line-clamp-3 text-xs leading-5">
        {spec.description || 'No description has been added for this firework.'}
      </p>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Effect</dt>
          <dd className="text-foreground truncate font-medium">
            {spec.baseEffect?.name ?? 'Unknown'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Duration</dt>
          <dd className="text-foreground font-mono font-medium tabular-nums">
            {formatSecondsLabel(fireworkDurationOf(spec))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Calibre</dt>
          <dd className="text-foreground truncate font-mono font-medium tabular-nums">
            {spec.caliber || 'Not set'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Height</dt>
          <dd className="text-foreground font-mono font-medium tabular-nums">
            {spec.heightMeters == null ? 'Not set' : `${spec.heightMeters} m`}
          </dd>
        </div>
      </dl>
      {palette.length ? (
        <div className="mt-2.5 flex items-center gap-1.5" aria-label="Firework colour palette">
          {palette.map((colour) => (
            <span
              key={colour}
              className="size-4 rounded-full border border-white/25 shadow-sm"
              style={{ backgroundColor: colour }}
              title={colour}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
