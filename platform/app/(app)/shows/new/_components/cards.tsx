/**
 * Big tap-target cards for the new-show flow. One generic ChoiceCard plus a
 * small launch-position dot diagram. No sliders, no typing: every answer in
 * the flow is a card press.
 */
'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Selectable card. `multi` renders a checkbox-style corner tick (for
 * multi-select questions); otherwise it behaves like a radio card.
 */
export function ChoiceCard({
  selected,
  title,
  description,
  hint,
  diagram,
  multi = false,
  onClick,
  className,
}: {
  selected: boolean;
  title: string;
  description?: string;
  /** Small right-aligned value, e.g. a price. */
  hint?: string;
  /** Optional visual rendered above the title (e.g. position dots). */
  diagram?: ReactNode;
  multi?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 relative flex min-h-[5.5rem] flex-col justify-center gap-1 rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-3 sm:p-5',
        selected
          ? 'border-[color:var(--color-content-emphasis)]/60 bg-[color:var(--color-bg-subtle)]'
          : 'border-[color:var(--color-border-subtle)] hover:border-[color:var(--color-border-default)] hover:bg-[color:var(--color-bg-subtle)]/50',
        className,
      )}
    >
      {multi ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-3 right-3 inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
            selected
              ? 'border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]'
              : 'border-[color:var(--color-border-default)]',
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
    </button>
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
