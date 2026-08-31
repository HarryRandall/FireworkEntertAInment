'use client';

import { ChevronDown, RotateCcw, Save } from 'lucide-react';
import { useId, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { Input } from '@/app/components/ui/Input';
import { SelectField, type SelectOption } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { Switch } from '@/components/ui/switch';
import {
  makeBurstTrailPreset,
  type BurstTrailPreset,
  type FireworkStarLayer,
} from '@/lib/fireworks/design';
import { NO_STYLE_DEFAULT_VALUE } from '@/lib/fireworks/style-defaults';

type BurstTrail = FireworkStarLayer['burstTrail'];

const TRAIL_PRESET_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'sparkDust', label: 'Spark dust' },
  { value: 'solidStreaks', label: 'Solid streaks' },
  { value: 'willowHang', label: 'Willow hang' },
  { value: 'cometTail', label: 'Comet tail' },
  { value: 'denseBrocade', label: 'Dense brocade' },
  { value: 'custom', label: 'Custom' },
];

const TRAIL_COLOUR_OPTIONS = [
  { value: 'star', label: 'Star colour' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'ember', label: 'Ember' },
  { value: 'starFade', label: 'Star, fading to ember' },
];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function EditorStyleDefaultControls({
  label,
  value,
  options,
  disabled,
  saveDisabled,
  resetDisabled,
  inheritedLabel,
  onChange,
  onSave,
  onReset,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  saveDisabled?: boolean;
  resetDisabled?: boolean;
  inheritedLabel?: string | null;
  onChange: (value: string) => void;
  onSave: (name: string) => void;
  onReset: () => void;
}) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const isCustom = value === NO_STYLE_DEFAULT_VALUE;
  const selectedOption = options.find((option) => option.value === value);

  function openSaveDialog() {
    setDraftName('');
    setSaveDialogOpen(true);
  }

  function confirmSave() {
    const trimmed = draftName.trim();
    if (!trimmed || saveDisabled) return;
    onSave(trimmed);
    setSaveDialogOpen(false);
  }

  function confirmReset() {
    onReset();
    setResetDialogOpen(false);
  }

  return (
    <div className="space-y-3 border-t border-[color:var(--color-border-subtle)] pt-5">
      <Field>
        <div className="flex items-center gap-1.5">
          <FieldLabel>{label}</FieldLabel>
          <InfoTooltip text="Save these settings as a reusable effect, or pick a saved effect to copy its settings into this editor." />
        </div>
        <SelectField
          value={value}
          onChange={onChange}
          options={options}
          ariaLabel={label}
          disabled={disabled}
          className="h-auto min-h-10 py-2"
        />
        {!isCustom && inheritedLabel ? (
          <p className="text-xs text-[color:var(--color-content-muted)]">{inheritedLabel}</p>
        ) : null}
      </Field>
      <div className="flex items-center gap-2">
        {isCustom ? (
          <Button
            variant="secondary"
            size="sm"
            className="min-h-9 flex-1 justify-center gap-1.5 px-2 text-center leading-tight whitespace-normal"
            onClick={openSaveDialog}
            disabled={disabled || saveDisabled}
          >
            <Save size={14} />
            Save as effect
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="min-h-9 flex-1 justify-center gap-1.5 px-2 text-center leading-tight whitespace-normal"
            onClick={() => setResetDialogOpen(true)}
            disabled={disabled || resetDisabled}
          >
            <RotateCcw size={14} />
            Reset
          </Button>
        )}
      </div>
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save {label.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Give this preset a name so you can apply it elsewhere later.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="style-default-save-name">Name</FieldLabel>
            <Input
              id="style-default-save-name"
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  confirmSave();
                }
              }}
              placeholder="e.g. Gold peony"
            />
          </Field>
          <DialogFooter>
            <Button onClick={confirmSave} disabled={saveDisabled || draftName.trim().length === 0}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              This reverts to {selectedOption ? `"${selectedOption.label}"` : 'the saved style'} and
              discards any changes you have made here for this effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmReset}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function EditorTrailPanel({
  trail,
  disabled,
  onChange,
}: {
  trail: BurstTrail;
  disabled?: boolean;
  onChange: (trail: BurstTrail, custom?: boolean) => void;
}) {
  const toggleId = useId();
  const advancedId = useId();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const controlsDisabled = disabled || !trail.enabled;
  const lengthPercent = Math.round(Math.min(100, Math.max(0, (trail.width.tail / 4) * 100)));
  const particleSizePercent = Math.round(
    Math.min(100, Math.max(0, (trail.particleSize.base / 24) * 100)),
  );

  function patch(updater: (trail: BurstTrail) => BurstTrail, custom = true) {
    onChange(updater(JSON.parse(JSON.stringify(trail)) as BurstTrail), custom);
  }

  return (
    <div className="space-y-6">
      <div className="flex min-h-10 items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
          Burst trail
        </h3>
        <Switch
          id={toggleId}
          aria-label="Show burst trail"
          checked={trail.enabled}
          disabled={disabled}
          onCheckedChange={(value) => patch((current) => ({ ...current, enabled: value }), false)}
        />
      </div>

      <Field>
        <FieldLabel>Preset</FieldLabel>
        <SelectField
          value={trail.preset}
          onChange={(value) => onChange(makeBurstTrailPreset(value as BurstTrailPreset), false)}
          options={TRAIL_PRESET_OPTIONS}
          ariaLabel="Trail preset"
          disabled={controlsDisabled}
        />
      </Field>

      <Field>
        <FieldLabel>Trail colour</FieldLabel>
        <SelectField
          value={trail.colourMode}
          onChange={(value) =>
            patch((current) => ({ ...current, colourMode: value as BurstTrail['colourMode'] }))
          }
          options={TRAIL_COLOUR_OPTIONS}
          ariaLabel="Trail colour"
          disabled={controlsDisabled}
        />
      </Field>

      <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
        <SliderField
          label="Length"
          min={0}
          max={100}
          step={1}
          value={lengthPercent}
          formatValue={formatPercent}
          disabled={controlsDisabled}
          onChange={(value) =>
            patch((current) => ({
              ...current,
              width: { ...current.width, tail: round2((value / 100) * 4) },
            }))
          }
        />
        <SliderField
          label="Particle size"
          min={0}
          max={100}
          step={1}
          value={particleSizePercent}
          formatValue={formatPercent}
          disabled={controlsDisabled}
          onChange={(value) =>
            patch((current) => ({
              ...current,
              particleSize: { ...current.particleSize, base: round2((value / 100) * 24) },
            }))
          }
        />
      </div>

      <div>
        <button
          type="button"
          aria-expanded={advancedOpen}
          aria-controls={advancedId}
          className="focus-visible:ring-ring/50 -ml-1 inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold text-[color:var(--color-content-subtle)] transition hover:text-[color:var(--color-content-emphasis)] focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <ChevronDown
            size={18}
            className={!advancedOpen ? '-rotate-90 transition-transform' : 'transition-transform'}
            aria-hidden
          />
          Advanced trail
        </button>
        {advancedOpen ? (
          <div id={advancedId} className="mt-5 grid gap-x-7 gap-y-5 sm:grid-cols-2">
            <SliderField
              label="Amount"
              min={0}
              max={2000}
              step={1}
              value={trail.particlesPerStar}
              disabled={controlsDisabled}
              onChange={(value) =>
                patch((current) => ({ ...current, particlesPerStar: Math.round(value) }))
              }
            />
            <SliderField
              label="Trail brightness"
              min={0}
              max={3}
              step={0.01}
              value={trail.intensity.brightness}
              formatValue={(value) => `${value.toFixed(2)}x`}
              disabled={controlsDisabled}
              onChange={(value) =>
                patch((current) => ({
                  ...current,
                  intensity: { ...current.intensity, brightness: round2(value) },
                }))
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
