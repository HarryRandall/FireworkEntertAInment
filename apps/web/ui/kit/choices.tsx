/** Radio cards, checkbox tiles and swatches adapted from shadcn choice primitives. */
'use client';
import type { ReactNode } from 'react';
import { RadioGroup, Checkbox, ToggleGroup } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Describes a choice with a stable value and optional explanation or icon. */
export interface Choice {
  value: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}
const card =
  'relative grid min-w-0 gap-1 rounded-lg border border-border bg-card p-(--card-padding) text-left text-sm hover:border-border-strong data-[state=checked]:border-highlight data-[state=checked]:ring-1 data-[state=checked]:ring-highlight disabled:opacity-50';
/** Presents one keyboard-navigable choice with explanatory cards. */
export function RadioCards({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly Choice[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={onChange}
      className="grid gap-(--card-gap) sm:grid-cols-2"
    >
      {items.map((item) => (
        <RadioGroup.Item
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          className={card}
        >
          {item.icon}
          <b className="pr-6 text-base font-semibold">{item.title}</b>
          <span className="text-muted-foreground text-xs">{item.description}</span>
          <RadioGroup.Indicator className="text-highlight-foreground absolute top-3 right-3">
            <Check className="size-4" />
          </RadioGroup.Indicator>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
/** Presents independent keyboard-operable choices as compact tiles. */
export function CheckboxCards({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly Choice[];
  value: readonly string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-1 gap-(--card-gap) sm:grid-cols-4"
    >
      {items.map((item) => (
        <Checkbox.Root
          key={item.value}
          disabled={item.disabled}
          checked={value.includes(item.value)}
          onCheckedChange={(checked) => {
            onChange(
              checked === true
                ? [...value, item.value]
                : value.filter((selected) => selected !== item.value),
            );
          }}
          className={card}
        >
          {item.icon}
          <b className="text-base font-semibold">{item.title}</b>
          <span className="text-muted-foreground text-xs">{item.description}</span>
          <Checkbox.Indicator className="text-highlight-foreground absolute top-3 right-3">
            <Check className="size-4" />
          </Checkbox.Indicator>
        </Checkbox.Root>
      ))}
    </div>
  );
}
/** Edits a multi-selection using shadcn's roving-focus toggle group pattern. */
export function Chips({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <ToggleGroup.Root
      type="multiple"
      aria-label={label}
      value={value}
      onValueChange={onChange}
      className="flex flex-wrap gap-2"
    >
      {items.map((item) => (
        <ToggleGroup.Item
          key={item}
          value={item}
          className="border-border bg-card data-[state=on]:border-highlight data-[state=on]:bg-highlight-soft data-[state=on]:text-highlight-foreground inline-flex min-h-(--control-height) items-center rounded-full border px-3 text-sm"
        >
          {item}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
/** Selects one authored colour; labels must describe colour rather than relying on appearance. */
export function Swatches({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly { colour: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={onChange}
      className="flex flex-wrap gap-2"
    >
      {items.map((item) => (
        <RadioGroup.Item
          key={item.colour}
          value={item.colour}
          aria-label={item.label}
          style={{ backgroundColor: item.colour }}
          className={cn(
            'border-card ring-border data-[state=checked]:ring-foreground size-8 rounded-full border-2 ring-1 data-[state=checked]:ring-2',
          )}
        />
      ))}
    </RadioGroup.Root>
  );
}
