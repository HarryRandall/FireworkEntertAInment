/** Switch and segmented filters retain shadcn's Radix keyboard semantics. */
'use client';
import { Switch as RadixSwitch, ToggleGroup } from 'radix-ui';

/** Edits an on/off preference and announces its checked state. */
export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <RadixSwitch.Root
      aria-label={label}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className="bg-border-strong data-[state=checked]:bg-highlight h-5 w-9 rounded-full data-[disabled]:opacity-50"
    >
      <RadixSwitch.Thumb className="bg-card block size-4 translate-x-0.5 rounded-full transition-transform data-[state=checked]:translate-x-4 motion-reduce:transition-none" />
    </RadixSwitch.Root>
  );
}
/** Filters locally with one selected value and arrow-key navigation. */
export function SegmentedControl({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next.length > 0) {
          onChange(next);
        }
      }}
      className="border-border bg-muted flex w-fit max-w-full flex-wrap gap-1 rounded-md border p-1"
    >
      {items.map((item) => (
        <ToggleGroup.Item
          key={item}
          value={item}
          className="text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground rounded px-3 py-1 text-xs data-[state=on]:shadow-sm"
        >
          {item}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
