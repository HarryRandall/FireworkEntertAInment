'use client';

/** Labelled colour field built on the modern ColorPicker, with optional "inherit" clear. */
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { ColorPicker } from '@/app/components/ui/ColorPicker';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { cn } from '@/lib/utils';

const HEX = /^#[0-9a-fA-F]{6}$/;

function normalise(value: string | null): string {
  const trimmed = (value ?? '').trim();
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
  const hasValue = value != null && value.trim() !== '';

  return (
    <Field>
      <div className="flex items-center gap-1.5">
        <FieldLabel>{label}</FieldLabel>
        {hint ? <InfoTooltip text={hint} /> : null}
      </div>
      <div className="flex items-center gap-2">
        {allowClear && !hasValue ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={`Set ${label}`}
            onClick={() => onChange('#ffffff')}
            className={cn(
              'focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] pr-3 pl-1.5 text-xs text-[color:var(--color-content-subtle)] shadow-xs transition-colors hover:border-[color:var(--color-border-emphasis)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <span
              className="h-6 w-6 shrink-0 rounded-md bg-[linear-gradient(135deg,transparent_45%,var(--color-border-emphasis)_45%,var(--color-border-emphasis)_55%,transparent_55%)] ring-1 ring-black/10 ring-inset"
              aria-hidden
            />
            Inherit from effect
          </button>
        ) : (
          <ColorPicker
            label={label}
            value={normalise(value)}
            disabled={disabled}
            onChange={(hex) => onChange(hex)}
          />
        )}
        {allowClear && hasValue ? (
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
    </Field>
  );
}
