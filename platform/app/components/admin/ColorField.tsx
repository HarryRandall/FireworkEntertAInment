'use client';

/** Hex colour input with a native picker, text entry, and quick preset swatches. */
import { useId } from 'react';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { FIREWORK_COLOR_VALUES } from '@/lib/fireworks/spec';
import { cn } from '@/lib/utils';

const HEX = /^#[0-9a-fA-F]{6}$/;

function normalise(value: string): string {
  const trimmed = value.trim();
  return HEX.test(trimmed) ? trimmed.toLowerCase() : '#ffffff';
}

export function ColorField({
  label,
  value,
  onChange,
  disabled,
  hint,
  allowClear = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  hint?: string;
  allowClear?: boolean;
}) {
  const id = useId();
  const current = value ?? '';
  const picker = normalise(current || '#ffffff');

  return (
    <Field>
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {hint ? <InfoTooltip text={hint} /> : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-[color:var(--color-border-subtle)] bg-transparent disabled:cursor-not-allowed"
          value={picker}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value.toLowerCase())}
        />
        <input
          id={id}
          type="text"
          inputMode="text"
          placeholder={allowClear ? 'Inherit from effect' : '#ff0043'}
          className="h-9 w-28 rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] px-2 font-mono text-sm text-[color:var(--color-content-emphasis)] disabled:cursor-not-allowed"
          value={current}
          disabled={disabled}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (next.trim() === '') {
              onChange(allowClear ? null : '#ffffff');
            } else {
              onChange(next.toLowerCase());
            }
          }}
        />
        {allowClear && value ? (
          <button
            type="button"
            className="text-xs text-[color:var(--color-content-subtle)] underline-offset-2 hover:underline disabled:opacity-50"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FIREWORK_COLOR_VALUES.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={`Use ${preset}`}
            disabled={disabled}
            onClick={() => onChange(preset)}
            className={cn(
              'h-5 w-5 rounded-full border border-[color:var(--color-border-subtle)] transition-transform hover:scale-110 disabled:cursor-not-allowed',
              value?.toLowerCase() === preset.toLowerCase()
                ? 'ring-2 ring-[color:var(--color-content-emphasis)] ring-offset-1'
                : '',
            )}
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>
    </Field>
  );
}
