/** Decorative motion components adapted from Magic UI; each one is still under reduced motion. */
'use client';
import Link from 'next/link';
import { useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

const shimmerClasses =
  'sc-shimmer bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring relative isolate inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50';

/** Highlights the main action with a passing shimmer. */
export function ShimmerButton({ className, children, ...props }: ComponentProps<'button'>) {
  return (
    <button type="button" className={cn(shimmerClasses, className)} {...props}>
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

/** The shimmer action as a navigation link. */
export function ShimmerLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link className={cn(shimmerClasses, className)} {...props}>
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

/**
 * Traces a light around the border of its content. `surface` is the colour inside the
 * border; it defaults to the card token.
 */
export function BorderBeam({
  children,
  className,
  surface,
}: {
  children: ReactNode;
  className?: string;
  surface?: string;
}) {
  return (
    <div
      className={cn('sc-border-beam relative isolate overflow-hidden rounded-xl', className)}
      style={surface ? ({ '--sc-beam-surface': surface } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Scrolls a row of items sideways. It pauses on hover, on focus and from its own control,
 * and becomes a wrapped row under reduced motion.
 */
export function Marquee({
  items,
  label,
  className,
}: {
  items: readonly { key: string; node: ReactNode }[];
  /** Names the content for the pause control. */
  label: string;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <div
      className={cn('sc-marquee relative flex items-center gap-3 overflow-hidden', className)}
      data-paused={paused || undefined}
    >
      <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <ul className="sc-marquee-track flex w-max gap-3">
          {items.map((item) => (
            <li key={item.key} className="shrink-0">
              {item.node}
            </li>
          ))}
          {items.map((item) => (
            <li key={`${item.key}-copy`} aria-hidden="true" className="sc-marquee-copy shrink-0">
              {item.node}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:hidden"
        aria-pressed={paused}
        aria-label={paused ? `Resume ${label}` : `Pause ${label}`}
        onClick={() => setPaused((current) => !current)}
      >
        {paused ? <Play aria-hidden size={12} /> : <Pause aria-hidden size={12} />}
      </button>
    </div>
  );
}

/** Moves a brand gradient through text; reduced motion keeps solid primary text. */
export function AnimatedGradientText({ children }: { children: ReactNode }) {
  return <span className="sc-gradient-text inline-block">{children}</span>;
}

/** Fades content in from a slight blur as soon as it mounts. */
export function BlurFade({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Milliseconds before the fade starts. */
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('sc-blur-fade', className)}
      style={{ '--sc-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
