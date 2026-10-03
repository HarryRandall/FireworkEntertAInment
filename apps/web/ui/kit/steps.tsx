/** Controlled vertical and horizontal workflows adapted from ReUI's stepper. */
'use client';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A named workflow step and its explanatory text. */
export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
}
/** Shows zero-based current/reached positions; only reached steps are navigable. */
export function Steps({
  items,
  current,
  reached = current,
  orientation = 'vertical',
  onChange,
}: {
  items: readonly WorkflowStep[];
  current: number;
  reached?: number;
  orientation?: 'vertical' | 'horizontal';
  onChange?: (index: number) => void;
}) {
  return (
    <ol
      aria-label="Progress"
      className={cn('flex gap-2', orientation === 'vertical' ? 'flex-col' : 'flex-wrap')}
    >
      {items.map((item, index) => (
        <li key={item.id} aria-current={index === current ? 'step' : undefined} className="min-w-0">
          <button
            type="button"
            disabled={index > reached || onChange === undefined}
            onClick={() => onChange?.(index)}
            className={cn(
              'flex w-full items-start gap-3 rounded-md p-2 text-left disabled:cursor-default',
              index > reached ? 'opacity-50' : 'hover:bg-accent',
            )}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs',
                index < current
                  ? 'border-highlight bg-highlight text-primary-foreground'
                  : 'border-border-strong',
                index === current && 'ring-ring/30 ring-2',
              )}
            >
              {index < current ? <Check className="size-3" /> : index + 1}
            </span>
            <span className="grid gap-0.5">
              <b className="text-sm font-medium">{item.title}</b>
              {item.description !== undefined && (
                <small className="text-muted-foreground">{item.description}</small>
              )}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
