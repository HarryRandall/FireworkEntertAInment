/**
 * Budget chip-picker with a "Custom" toggle that flips to a numeric input.
 *
 * Owns no state itself — the parent passes both the resolved budget and the
 * draft custom string so back-navigation never loses the user's typed value.
 */
'use client';

import { Wallet } from 'lucide-react';
import { ChoiceChip } from '@/app/components/ui/Badge';
import { Input } from '@/app/components/ui/Input';
import { BUDGET_PRESETS } from '../constants';
import { Field } from './Field';

export function BudgetPicker({
  budget,
  mode,
  customValue,
  onBudgetChange,
  onModeChange,
  onCustomValueChange,
}: {
  budget: number;
  mode: 'preset' | 'custom';
  customValue: string;
  onBudgetChange: (n: number) => void;
  onModeChange: (mode: 'preset' | 'custom') => void;
  onCustomValueChange: (value: string) => void;
}) {
  const isPreset =
    mode === 'preset' && BUDGET_PRESETS.includes(budget as (typeof BUDGET_PRESETS)[number]);
  return (
    <Field
      label="Budget"
      required
      icon={<Wallet size={13} strokeWidth={1.75} />}
      trailing={
        <span className="text-sm font-semibold text-[color:var(--color-content-emphasis)] tabular-nums">
          ${budget.toLocaleString()}
        </span>
      }
    >
      <div className="flex flex-wrap gap-2">
        {BUDGET_PRESETS.map((preset) => (
          <ChoiceChip
            key={preset}
            selected={isPreset && budget === preset}
            onClick={() => {
              onModeChange('preset');
              onBudgetChange(preset);
            }}
          >
            ${preset.toLocaleString()}
            {preset === 5000 ? '+' : ''}
          </ChoiceChip>
        ))}
        <ChoiceChip
          selected={mode === 'custom'}
          onClick={() => {
            onModeChange('custom');
            onCustomValueChange(customValue || String(budget));
          }}
        >
          Custom
        </ChoiceChip>
      </div>
      {mode === 'custom' ? (
        <Input
          type="number"
          min={50}
          max={5000}
          step={50}
          inputMode="numeric"
          value={customValue}
          placeholder="Custom budget"
          className="mt-3"
          onChange={(e) => {
            const value = e.target.value;
            onCustomValueChange(value);
            if (value === '') return;
            const n = Number(value);
            // Mirror the preset chip's contract: we only commit values the
            // server-side schema would accept, so the parent's `budget`
            // never holds garbage from a half-typed input.
            if (Number.isFinite(n) && n >= 50) onBudgetChange(n);
          }}
        />
      ) : null}
    </Field>
  );
}
