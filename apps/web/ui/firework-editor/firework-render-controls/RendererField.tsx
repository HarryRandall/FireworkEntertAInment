'use client';

import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Input } from '@/ui/patterns/Input';
import { SliderField } from '@/ui/patterns/SliderField';
import { useId, useRef, useState, type ComponentProps } from 'react';

type Props = ComponentProps<typeof SliderField> & { inputKind?: 'slider' | 'number' };

export function RendererField(props: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const skipCommit = useRef(false);
  const edited = useRef(false);
  const { min, max, step = 1, value, disabled, label, hint, onChange, onCommit } = props;
  const inputText = String(Number(value.toPrecision(12)));

  function commitNumber() {
    if (skipCommit.current) {
      skipCommit.current = false;
      setDraft(null);
      return;
    }
    if (
      edited.current &&
      draft !== null &&
      draft.trim() &&
      Number.isFinite(Number(draft)) &&
      Number(draft) !== value
    ) {
      const parsed = Number(draft);
      const next = Math.min(
        max,
        Math.max(min, step >= 1 ? Math.round(parsed / step) * step : parsed),
      );
      onChange(next);
      onCommit?.(next);
    }
    setDraft(null);
  }

  if (props.inputKind !== 'number')
    return <SliderField {...props} showNumberInput layout="stacked" />;
  return (
    <Field className={props.fullWidth ? 'col-span-full' : undefined}>
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor={`${id}-value`} className="text-xs">
          {label}
        </FieldLabel>
        {hint ? <InfoTooltip text={hint} /> : null}
      </div>
      <Input
        id={`${id}-value`}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? inputText}
        disabled={disabled}
        className="h-8 font-mono text-xs"
        onFocus={() => {
          edited.current = false;
          setDraft(inputText);
        }}
        onChange={(event) => {
          edited.current = true;
          setDraft(event.target.value);
        }}
        onBlur={commitNumber}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            skipCommit.current = true;
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
      />
      {props.formatValue ? (
        <span className="text-muted-foreground text-xs">{props.formatValue(value)}</span>
      ) : null}
    </Field>
  );
}
