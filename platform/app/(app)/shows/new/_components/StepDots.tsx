/**
 * Minimal Suno-style progress indicator for the new-show wizard.
 *
 * One marker per step; the active step is an elongated pill, every other step
 * is a small dim dot. The markers are non-interactive indicators only, so
 * backward navigation stays on the wizard's Back button (one clear path back,
 * matching the reference flow).
 */
'use client';

import { cn } from '@/lib/utils';

export function StepDots({
  stepIndex,
  total,
  className,
}: {
  stepIndex: number;
  total: number;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={`Step ${stepIndex + 1} of ${total}`}
      className={cn('flex items-center gap-2', className)}
    >
      {Array.from({ length: total }, (_, index) => {
        const active = index === stepIndex;
        return (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              active ? 'bg-foreground w-6' : 'bg-muted-foreground w-1.5',
            )}
          />
        );
      })}
    </div>
  );
}
