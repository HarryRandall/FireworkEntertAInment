'use client';

import { useId, type ReactNode } from 'react';
import {
  CALIBRATED_APPEARANCE_MAX,
  CALIBRATED_APPEARANCE_MIN,
  CALIBRATED_APPEARANCE_STEP,
  calibratedToRaw,
  rawToCalibrated,
  type CalibratedRange,
} from '@/components/admin/firework-render-controls/calibrated-slider';
import { Field, FieldLabel } from '@/components/design-system/Field';
import { InfoTooltip } from '@/components/design-system/InfoTooltip';
import { SliderField } from '@/components/design-system/SliderField';
import { Switch } from '@/components/ui/switch';

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function CalibratedSliderField({
  label,
  value,
  range,
  disabled,
  hint,
  fullWidth,
  onChange,
}: {
  label: string;
  value: number;
  range: CalibratedRange;
  disabled?: boolean;
  hint: ReactNode;
  fullWidth?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <SliderField
      label={label}
      min={CALIBRATED_APPEARANCE_MIN}
      max={CALIBRATED_APPEARANCE_MAX}
      step={CALIBRATED_APPEARANCE_STEP}
      value={rawToCalibrated(value, range)}
      formatValue={formatPercent}
      disabled={disabled}
      fullWidth={fullWidth}
      hint={hint}
      onChange={(next) => onChange(calibratedToRaw(next, range))}
    />
  );
}

export function SwitchField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();

  return (
    <Field>
      <div className="flex min-h-9 items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <InfoTooltip text={hint} />
        </div>
        <Switch
          id={id}
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      </div>
    </Field>
  );
}
