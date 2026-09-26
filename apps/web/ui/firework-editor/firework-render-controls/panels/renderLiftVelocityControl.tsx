'use client';
import { cn } from '@/lib/utils';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import type { LiftVelocityMode } from '@showcrafter/firework-editor/control-values';
import {
  LIFT_VELOCITY_OPTIONS,
  liftVelocityPresetMode,
  round2,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { ReactNode } from 'react';
import { RendererField as SliderField } from '../RendererField';

export function renderLiftVelocityControl(context: RendererControlsContext, hint: ReactNode) {
  const {
    liftVelocity,
    design,
    forceCustomLiftVelocity,
    disabled,
    setLiftVelocityMode,
    setForceCustomLiftVelocity,
    setRenderValue,
  } = context;
  const presetMode = liftVelocityPresetMode(liftVelocity);
  const selectedMode: LiftVelocityMode =
    forceCustomLiftVelocity || presetMode === 'custom' ? 'custom' : presetMode;

  return (
    <div className="space-y-3">
      <Field>
        <div className="flex items-center gap-1.5">
          <FieldLabel>Lift velocity</FieldLabel>
          <InfoTooltip text={hint} />
        </div>
        <div
          role="radiogroup"
          aria-label="Lift velocity"
          className="grid w-full grid-cols-4 gap-1 rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-subtle)]/50 p-1"
        >
          {LIFT_VELOCITY_OPTIONS.map((option) => {
            const active = selectedMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`Lift velocity ${option.label.toLowerCase()}`}
                disabled={disabled}
                onClick={() => setLiftVelocityMode(option.value)}
                className={cn(
                  'focus-visible:ring-ring/50 flex h-8 min-w-0 items-center justify-center rounded-md px-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? 'bg-[color:var(--color-bg-default)] text-[color:var(--color-content-emphasis)] shadow-xs'
                    : 'text-[color:var(--color-content-subtle)] hover:text-[color:var(--color-content-emphasis)]',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </Field>
      <p className="text-muted-foreground text-xs">
        Launch speed sets how high the shell rises. It normally bursts when it stops rising.
      </p>
      {selectedMode === 'custom' ? (
        <SliderField
          label="Custom velocity"
          min={4}
          max={40}
          step={0.1}
          value={round2(liftVelocity)}
          disabled={disabled}
          hint="Manual launch speed, which sets the burst height."
          onChange={(value) => {
            setForceCustomLiftVelocity(true);
            setRenderValue('liftVelocity', round2(value));
          }}
        />
      ) : null}
      <SliderField
        label="Maximum flight time"
        inputKind="number"
        min={2}
        max={60}
        step={0.1}
        value={design.shellLife}
        formatValue={(value) => `${value} s`}
        disabled={disabled}
        hint="Burst by this time if the shell has not already reached its highest point."
        onChange={(value) => setRenderValue('shellLife', value)}
      />
    </div>
  );
}
