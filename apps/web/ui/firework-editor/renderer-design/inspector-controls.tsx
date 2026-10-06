/** Inspector presentation reuses the kit's controls with relative word labels. */
'use client';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './disclosure';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

import { Switch } from '@/ui/primitives/switch';
import { SelectField } from '@/ui/patterns/SelectField';
import { Button } from '@/ui/patterns/Button';
import { HoverPreview } from './hover-preview';
import { useId, type ReactNode } from 'react';
import type { Design, Layer } from '@showcrafter/renderer/schema';
import type { RelativeControl } from '@/lib/renderer-editor/relative-control';
import { Slider } from '@/ui/primitives/slider';
import { Hint } from './hint';

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
  previewAddress: string;
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
    <Accordion type="multiple" defaultValue={open ? [title] : []} className="space-y-3">
      <AccordionItem value={title}>
        <AccordionTrigger className="text-sm">{title}</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">{children}</div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
  const id = useId();
  const min = Math.min(control.min, value);
  const max = Math.max(control.max, value);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_5rem] items-center gap-2">
      <Hint label={`${control.label}: ${control.low} to ${control.high}`}>
        <Label htmlFor={id} className="text-xs font-medium">
          {control.label}
        </Label>
      </Hint>
      <Slider
        aria-label={control.label}
        value={[value]}
        min={min}
        max={max}
        step={control.step}
        disabled={disabled}
        className="cursor-pointer"
        onValueChange={(values) => {
          const next = values[0];
          if (next !== undefined) onChange(next);
        }}
      />
      <Input
        id={id}
        aria-label={`${control.label} value`}
        type="number"
        value={value}
        min={min}
        max={max}
        step={control.step}
        disabled={disabled}
        className="h-8 text-xs"
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          if (Number.isFinite(next) && next >= min && next <= max) onChange(next);
        }}
      />
    </div>
  );
}
/** Presents compact wrapping choices with an equivalent shared select on narrow inspector surfaces. */
export function InspectorChoices<K extends string>({
  label,
  items,
  value,
  disabled,
  onChange,
  labels,
  preview,
}: {
  label: string;
  preview?: (value: K) => Design | null;
  previewAddress?: string;
  climbPreview?: boolean;
  labels?: Partial<Record<K, string>>;
  items: readonly K[];
  value: string;
  disabled: boolean;
  onChange: (value: K) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      {preview ? (
        <div role="group" aria-label={label} className="flex flex-wrap gap-1">
          {items.map((item) => (
            <HoverPreview
              key={item}
              name={labels?.[item] ?? humanise(item)}
              document={preview(item)}
            >
              <Button
                variant={value === item ? 'primary' : 'secondary'}
                aria-pressed={value === item}
                disabled={disabled}
                onClick={() => onChange(item)}
                className="h-8 px-2 text-xs"
              >
                {labels?.[item] ?? humanise(item)}
              </Button>
            </HoverPreview>
          ))}
        </div>
      ) : (
        <SelectField
          value={value}
          disabled={disabled}
          ariaLabel={label}
          options={[
            ...(!items.some((item) => item === value) ? [{ value, label: 'Custom' }] : []),
            ...items.map((item) => ({ value: item, label: labels?.[item] ?? humanise(item) })),
          ]}
          onChange={(next) => {
            const option = items.find((item) => item === next);
            if (option !== undefined) onChange(option);
          }}
        />
      )}
    </div>
  );
}
/** Toggles an authored boolean with a labelled shared switch. */
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
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Switch id={id} checked={value} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
/** Edits one sRGB hex colour with a compact swatch and its readable value. */
export function InspectorColour({
  label,
  name,
  value,
  disabled,
  onChange,
}: {
  label: string;
  /** Accessible name when several colours share one visible label. */
  name?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground font-mono text-[11px] uppercase">{value}</span>
        <Input
          id={id}
          type="color"
          aria-label={name ?? label}
          value={value}
          disabled={disabled}
          className="h-8 w-12 p-1"
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </span>
    </div>
  );
}
/** Gives renderer enum values readable British-English chip labels. */
export function humanise(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase());
}
