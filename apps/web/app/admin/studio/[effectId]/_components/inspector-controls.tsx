/** Inspector presentation reuses the kit's controls with relative word labels and gesture boundaries. */
'use client';
import { useRef, type Dispatch, type ReactNode } from 'react';
import type { Design, Layer } from '@showcrafter/fireworks/schema';
import type { StudioEdit } from '@/lib/studio/document';
import type { RelativeControl } from '@/lib/studio/relative-control';
import { Slider } from '@/ui/kit/number-controls';
import { Button } from '@/ui/primitives/button';

/** Validated edits of the selected document, with no parallel inspector state. */
export interface InspectorContext {
  document: Design;
  disabled: boolean;
  levels: Readonly<Record<string, number>>;
  adjust: (key: string, level: number) => void;
  edit: (change: (draft: Design) => void) => void;
}
/** A selected star group and a scoped edit that cannot change a sibling group. */
export interface LayerContext extends InspectorContext {
  layer: Layer;
  changeLayer: (change: (layer: Layer) => void) => void;
}
/** Keeps pointer drags as one history entry; number-row typing commits when focus leaves the input. */
export function InspectorGestures({
  dispatch,
  children,
}: {
  dispatch: Dispatch<StudioEdit>;
  children: ReactNode;
}) {
  const pointer = useRef(false);
  const commitPointer = () => {
    if (pointer.current) dispatch({ type: 'commit' });
    pointer.current = false;
  };
  return (
    <div
      onPointerDownCapture={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        pointer.current = true;
        dispatch({ type: 'begin' });
      }}
      onPointerUpCapture={commitPointer}
      onLostPointerCapture={commitPointer}
      onPointerCancelCapture={() => {
        pointer.current = false;
        dispatch({ type: 'cancel' });
      }}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLInputElement) dispatch({ type: 'begin' });
      }}
      onBlurCapture={(event) => {
        if (event.target instanceof HTMLInputElement) dispatch({ type: 'commit' });
      }}
      onKeyDownCapture={(event) => {
        if (event.target instanceof Element && event.target.getAttribute('role') === 'slider')
          dispatch({ type: 'begin' });
      }}
      onKeyUpCapture={(event) => {
        if (event.target instanceof Element && event.target.getAttribute('role') === 'slider')
          dispatch({ type: 'commit' });
      }}
    >
      {children}
    </div>
  );
}
/** Groups a coherent inspector behaviour in a keyboard-operable disclosure. */
export function InspectorSection({
  title,
  children,
  open = true,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="sc-inspector-section" open={open}>
      <summary className="cursor-pointer py-3 font-medium">{title}</summary>
      <div className="grid gap-4 pb-4">{children}</div>
    </details>
  );
}
/** Edits a bounded scalar in stored units, presenting relative words rather than measurements. */
export function RelativeSlider({
  control,
  value,
  disabled,
  onChange,
}: {
  control: RelativeControl;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Slider
      label={control.label}
      value={value}
      min={Math.min(control.min, value)}
      max={Math.max(control.max, value)}
      step={control.step}
      disabled={disabled}
      ticks={[control.low, control.high]}
      format={() => ''}
      onChange={onChange}
    />
  );
}
/** Presents compact wrapping choices with an equivalent select on narrow inspector surfaces. */
export function InspectorChoices<K extends string>({
  label,
  items,
  value,
  disabled,
  onChange,
  labels,
}: {
  label: string;
  labels?: Partial<Record<K, string>>;
  items: readonly K[];
  value: string;
  disabled: boolean;
  onChange: (value: K) => void;
}) {
  return (
    <div className="grid gap-2">
      <span>{label}</span>
      <div role="group" aria-label={label} className="sc-inspector-chips flex flex-wrap gap-1">
        {items.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={value === item ? 'secondary' : 'outline'}
            aria-pressed={value === item}
            disabled={disabled}
            onClick={() => {
              onChange(item);
            }}
          >
            {labels?.[item] ?? humanise(item)}
          </Button>
        ))}
      </div>
      <select
        aria-label={label}
        className="sc-inspector-select border-input bg-background w-full rounded-md border p-2"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const option = items.find((item) => item === event.target.value);
          if (option !== undefined) onChange(option);
        }}
      >
        {!items.some((item) => item === value) && <option value={value}>Custom</option>}
        {items.map((item) => (
          <option key={item} value={item}>
            {labels?.[item] ?? humanise(item)}
          </option>
        ))}
      </select>
    </div>
  );
}
/** Toggles an authored boolean with a labelled pressed button. */
export function InspectorToggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <Button
        size="sm"
        variant="outline"
        aria-label={label}
        aria-pressed={value}
        disabled={disabled}
        onClick={() => {
          onChange(!value);
        }}
      >
        {value ? 'On' : 'Off'}
      </Button>
    </div>
  );
}
/** Gives renderer enum values readable British-English chip labels. */
export function humanise(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase());
}
