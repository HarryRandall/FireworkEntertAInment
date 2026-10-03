/** CSS adaptations of Magic UI's decorative animation patterns. */
'use client';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Highlights an action with Magic UI's shimmer; reduced motion renders a static button. */
export function ShimmerButton({ className, children, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'sc-shimmer bg-primary text-primary-foreground relative isolate overflow-hidden rounded-full px-6 py-3 text-sm font-medium disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}
/** Traces a decorative border around content without consuming focus or pointer events. */
export function BorderBeam({ children }: { children: ReactNode }) {
  return (
    <div className="sc-border-beam border-border bg-card relative isolate overflow-hidden rounded-xl border p-6">
      <div className="relative z-10">{children}</div>
    </div>
  );
}
/** Repeats decorative content; pauses on hover/focus and becomes a wrapped list under reduced motion. */
export function Marquee({ items }: { items: readonly string[] }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="sc-marquee border-border bg-muted overflow-hidden rounded-lg border p-3">
      <div
        className="sc-marquee-track flex w-max gap-6"
        style={{ animationPlayState: paused ? 'paused' : 'running' }}
      >
        {items.map((item) => (
          <span key={item} className="text-sm">
            {item}
          </span>
        ))}
        <span aria-hidden="true" className="sc-marquee-copy flex gap-6">
          {items.map((item) => (
            <span key={item} className="text-sm">
              {item}
            </span>
          ))}
        </span>
      </div>
      <button
        type="button"
        className="border-border bg-card mt-3 rounded border px-2 py-1 text-xs motion-reduce:hidden"
        aria-pressed={paused}
        onClick={() => {
          setPaused(!paused);
        }}
      >
        {paused ? 'Resume motion' : 'Pause motion'}
      </button>
    </div>
  );
}
/** Animates a highlight gradient through decorative text, retaining static contrast with reduced motion. */
export function AnimatedGradientText({ children }: { children: ReactNode }) {
  return <span className="sc-gradient-text inline-block font-semibold">{children}</span>;
}
/** Reveals content with a short blur/fade; reduced motion keeps it visible immediately. */
export function BlurFade({ children }: { children: ReactNode }) {
  return <div className="sc-blur-fade">{children}</div>;
}
