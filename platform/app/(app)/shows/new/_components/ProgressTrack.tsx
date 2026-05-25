/**
 * The numbered "step pill" track at the top of the wizard. Renders the step
 * label + a state-coloured circle (complete / active / pending) and lets the
 * user jump back to any previously-completed step.
 */
'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Renders the numbered step header and dispatches `onSelect` for back-jumps. */
export function ProgressTrack({
  steps,
  current,
  onSelect,
}: {
  steps: readonly { key: string; label: string }[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {steps.map((step, index) => {
        const isActive = index === current;
        const isComplete = index < current;
        const isClickable = index <= current;
        return (
          <li key={step.key}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              disabled={!isClickable}
              className={cn(
                'inline-flex items-center gap-2 rounded-md py-1 text-sm transition-colors',
                isActive
                  ? 'text-[color:var(--color-content-emphasis)]'
                  : isComplete
                    ? 'text-[color:var(--color-content-default)] hover:text-[color:var(--color-content-emphasis)]'
                    : 'cursor-not-allowed text-[color:var(--color-content-muted)]',
              )}
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={cn(
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium',
                  isComplete &&
                    'border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]',
                  isActive &&
                    'border-[color:var(--color-content-emphasis)] text-[color:var(--color-content-emphasis)]',
                  !isActive &&
                    !isComplete &&
                    'border-[color:var(--color-border-default)] text-[color:var(--color-content-muted)]',
                )}
              >
                {isComplete ? <Check size={12} strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="font-medium">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
