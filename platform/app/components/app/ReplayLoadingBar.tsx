'use client';

/**
 * ReplayLoadingBar — floating "Loading fireworks" / "Preparing preview" status
 * bar shared by every canvas consumer. Shows a determinate progress bar while
 * the engine primes fireworks (`progress` is a 0..1 fraction) and an
 * indeterminate pulse before the cue set has landed or while the prime is
 * pending. `position` controls where it floats: `bottom` sits in the playback
 * slot until controls take that space, while `center` is reserved for
 * standalone surfaces such as the firework lab.
 */
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ReplayLoadingBarPosition = 'bottom' | 'center';
export type ReplayLoadingBarVariant = 'default' | 'compact';

export function ReplayLoadingBar({
  progress,
  position = 'bottom',
  variant = 'default',
}: {
  progress: number | null;
  position?: ReplayLoadingBarPosition;
  variant?: ReplayLoadingBarVariant;
}) {
  const determinate = progress != null;
  const compact = variant === 'compact';
  const pct = determinate ? Math.max(2, Math.round(progress * 100)) : 0;
  const positionClass =
    position === 'center'
      ? 'pointer-events-none absolute top-1/2 left-1/2 z-[80] flex -translate-x-1/2 -translate-y-1/2'
      : 'pointer-events-none absolute bottom-6 left-1/2 z-[80] flex -translate-x-1/2';
  const widthClass = compact ? 'w-auto max-w-[calc(100%-2rem)]' : 'w-[min(440px,calc(100%-2rem))]';
  const label = compact ? 'Loading...' : determinate ? 'Loading fireworks' : 'Preparing preview';
  return (
    <div
      className={cn(
        positionClass,
        widthClass,
        'border-outline-variant/15 bg-surface-container-low/90 items-center rounded-lg border shadow-[var(--shadow-modal)] backdrop-blur',
        compact ? 'gap-2 px-3 py-2' : 'gap-3 px-4 py-3',
      )}
      role="status"
      aria-live="polite"
      aria-label={compact ? 'Loading preview' : label}
    >
      <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" strokeWidth={2.5} />
      <span
        className={cn(
          'text-on-surface-variant shrink-0',
          compact ? 'text-xs font-semibold' : 'text-[10px] font-bold tracking-widest uppercase',
        )}
      >
        {label}
      </span>
      {compact ? null : (
        <>
          <div className="bg-surface-container-highest relative h-1.5 flex-1 overflow-hidden rounded-full">
            {determinate ? (
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-150 ease-out"
                style={{ width: `${pct}%` }}
              />
            ) : (
              <div className="bg-primary h-full w-full animate-pulse rounded-full opacity-70" />
            )}
          </div>
          <span className="text-on-surface-variant w-9 shrink-0 text-right font-mono text-[11px] tabular-nums">
            {determinate ? `${pct}%` : ''}
          </span>
        </>
      )}
    </div>
  );
}
