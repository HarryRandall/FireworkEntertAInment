'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { SelectField, type SelectOption } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { Switch } from '@/components/ui/switch';
import {
  makeBurstTrailPreset,
  type BurstTrailPreset,
  type FireworkStarLayer,
} from '@/lib/fireworks/design';

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
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-3">
      <Field>
        <FieldLabel>{label}</FieldLabel>
        <SelectField
          value={value}
          onChange={onChange}
          options={options}
          ariaLabel={label}
          disabled={disabled}
        />
        {inheritedLabel ? (
          <p className="text-xs text-[color:var(--color-content-muted)]">{inheritedLabel}</p>
        ) : null}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="min-h-9 px-2 text-center leading-tight whitespace-normal"
          onClick={onSave}
          disabled={disabled || saveDisabled}
        >
          Save new default
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-9 px-2 text-center leading-tight whitespace-normal"
          onClick={onReset}
          disabled={disabled || resetDisabled}
        >
          Clear edits
        </Button>
      </div>
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
