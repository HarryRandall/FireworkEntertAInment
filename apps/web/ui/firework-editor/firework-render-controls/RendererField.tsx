'use client';

import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Input } from '@/ui/patterns/Input';
import { SliderField } from '@/ui/patterns/SliderField';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from 'react';

type Props = ComponentProps<typeof SliderField> & { inputKind?: 'slider' | 'number' | 'knob' };

export function RendererField(props: Props) {
  const id = useId();
  const kind = props.inputKind ?? 'slider';
  const [draft, setDraft] = useState<string | null>(null);
  const skipCommit = useRef(false);
  const edited = useRef(false);
  const drag = useRef<{ y: number; value: number } | null>(null);
  const latest = useRef(props.value);
  useLayoutEffect(() => {
    latest.current = props.value;
  }, [props.value]);
  const { min, max, step = 1, value, disabled, label, hint, onChange, onCommit } = props;
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next / step) * step));
  const text = props.formatValue?.(value) ?? String(Number(value.toFixed(3)));
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
      const next = clamp(Number(draft));
      onChange(next);
      onCommit?.(next);
    }
    setDraft(null);
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let next: number;
    if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    else if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) {
      next =
        value +
        (['ArrowUp', 'ArrowRight'].includes(event.key) ? step : -step) * (event.shiftKey ? 10 : 1);
    } else return;
    event.preventDefault();
    onChange(clamp(next));
  }

  if (kind === 'slider') return <SliderField {...props} showNumberInput />;
  const fraction = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
  return (
    <Field className={props.fullWidth ? 'col-span-full' : undefined}>
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor={`${id}-value`} className="text-xs">
          {label}
        </FieldLabel>
        {hint ? <InfoTooltip text={hint} /> : null}
      </div>
      <div className="flex items-center gap-3">
        {kind === 'knob' ? (
          <button
            type="button"
            role="slider"
            aria-label={typeof label === 'string' ? label : props.inputAriaLabel}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={text}
            disabled={disabled}
            onKeyDown={keyDown}
            onKeyUp={() => onCommit?.(latest.current)}
            className="border-border bg-muted focus-visible:ring-ring relative size-11 shrink-0 touch-none rounded-full border shadow-sm outline-none focus-visible:ring-2 disabled:opacity-40"
            onPointerDown={(event) => {
              drag.current = { y: event.clientY, value };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (drag.current)
                onChange(
                  clamp(
                    drag.current.value +
                      ((event.clientY - drag.current.y) * (max - min)) /
                        (event.shiftKey ? 1000 : 180),
                  ),
                );
            }}
            onPointerUp={(event) => {
              drag.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
              onCommit?.(latest.current);
            }}
            onPointerCancel={() => {
              if (drag.current) onChange(drag.current.value);
              drag.current = null;
            }}
          >
            <span
              className="absolute inset-1.5 rounded-full"
              style={{ transform: `rotate(${-135 + fraction * 270}deg)` }}
            >
              <span className="bg-primary absolute top-0 left-1/2 h-2.5 w-0.5 -translate-x-1/2 rounded-full" />
            </span>
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
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
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                skipCommit.current = true;
                setDraft(null);
                event.currentTarget.blur();
              }
            }}
          />
          {props.formatValue ? <span className="text-muted-foreground text-xs">{text}</span> : null}
        </div>
      </div>
    </Field>
  );
}
