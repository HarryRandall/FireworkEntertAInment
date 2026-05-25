/**
 * Duration chip-picker mirroring {@link BudgetPicker}: presets + custom toggle.
 */
'use client';

import { ChoiceChip } from '@/app/components/ui/Badge';
import { Input } from '@/app/components/ui/Input';
import { DURATION_PRESETS } from '../constants';
import { Field } from './Field';

export function DurationPicker({
  mode,
  preset,
  customValue,
  onModeChange,
  onPresetChange,
  onCustomValueChange,
}: {
  mode: 'preset' | 'custom';
  preset: (typeof DURATION_PRESETS)[number];
  customValue: string;
  onModeChange: (mode: 'preset' | 'custom') => void;
  onPresetChange: (minutes: (typeof DURATION_PRESETS)[number]) => void;
  onCustomValueChange: (value: string) => void;
}) {
  return (
    <Field label="Duration" required>
      <div className="flex flex-wrap gap-2">
        {DURATION_PRESETS.map((minutes) => (
          <ChoiceChip
            key={minutes}
            selected={mode === 'preset' && preset === minutes}
            onClick={() => {
              onModeChange('preset');
              onPresetChange(minutes);
            }}
          >
            {minutes} min
          </ChoiceChip>
        ))}
        <ChoiceChip
          selected={mode === 'custom'}
          onClick={() => {
            onModeChange('custom');
            onCustomValueChange(customValue || String(preset));
          }}
        >
          Custom
        </ChoiceChip>
      </div>
      {mode === 'custom' ? (
        <Input
          type="number"
          min={1}
          max={60}
          step={1}
          inputMode="numeric"
          value={customValue}
          placeholder="Custom duration in minutes"
          className="mt-3"
          onChange={(e) => onCustomValueChange(e.target.value)}
        />
      ) : null}
    </Field>
  );
}
