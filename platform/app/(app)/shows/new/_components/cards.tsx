/**
 * Big tap-target cards for the new-show flow. One native-input ChoiceCard plus a
 * small launch-position dot diagram. No sliders, no typing: every answer in
 * the flow is a card press.
 */
'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Selectable card backed by a native radio or checkbox. Keeping the input in
 * the accessibility tree gives grouped radio cards standard arrow-key
 * behaviour without recreating that interaction in JavaScript.
 */
export function ChoiceCard({
  type,
  name,
  value,
  selected,
  title,
  description,
  hint,
  diagram,
  onSelect,
  className,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  selected: boolean;
  title: string;
  description?: string;
  /** Small right-aligned value, e.g. a price. */
  hint?: string;
  /** Optional visual rendered above the title (e.g. position dots). */
  diagram?: ReactNode;
  onSelect: () => void;
  className?: string;
}) {
  const multiple = type === 'checkbox';

  return (
    <label
      className={cn(
        'has-[input:focus-visible]:ring-ring/50 relative flex min-h-[5.5rem] w-full cursor-pointer flex-col justify-center gap-1 rounded-xl border-2 bg-[color:var(--color-bg-elevated)] p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] active:scale-[0.99] has-[input:focus-visible]:ring-3 sm:p-5',
        selected
          ? 'border-[color:var(--color-content-emphasis)]'
          : 'border-[color:var(--color-border-default)] hover:border-[color:var(--color-content-emphasis)]/40',
        className,
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        onClick={(event) => {
          // A checked radio does not emit another change event. Treating a
          // deliberate second activation as selection again preserves the
          // wizard's auto-advance behaviour after the user navigates back.
          if (type === 'radio' && selected && event.currentTarget.checked) onSelect();
        }}
        className="sr-only"
      />
      {selected || multiple ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-3 right-3 inline-flex h-5 w-5 items-center justify-center border transition-colors',
            multiple ? 'rounded-md' : 'rounded-full',
            selected
              ? 'border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)] shadow-sm'
              : 'border-[color:var(--color-border-default)] bg-[color:var(--color-bg-elevated)]/80',
          )}
        >
          {selected ? <Check size={12} strokeWidth={3} /> : null}
        </span>
      ) : null}
      {diagram ? <span className="mb-1.5">{diagram}</span> : null}
      <span className="flex items-baseline justify-between gap-3 pr-6">
        <span className="text-sm font-semibold text-[color:var(--color-content-emphasis)] sm:text-base">
          {title}
        </span>
        {hint ? (
          <span className="shrink-0 font-mono text-sm font-semibold text-[color:var(--color-content-default)] tabular-nums">
            {hint}
          </span>
        ) : null}
      </span>
      {description ? (
        <span className="text-xs leading-relaxed text-[color:var(--color-content-subtle)] sm:text-sm">
          {description}
        </span>
      ) : null}
    </label>
  );
}

/** 1-3 filled dots on a 3-slot track: how many firing positions fit. */
export function PositionDots({ count }: { count: 1 | 2 | 3 }) {
  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={`${count} firing position${count === 1 ? '' : 's'}`}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            'h-2.5 w-2.5 rounded-full transition-colors',
            index < count
              ? 'bg-[color:var(--color-accent)] shadow-[0_0_8px_-1px_var(--color-accent)]'
              : 'border border-[color:var(--color-border-default)]',
          )}
        />
      ))}
    </span>
  );
}
