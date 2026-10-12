/** Magic UI number ticker: counts up to a value over a short ease-out once it is on screen. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

const DURATION_MS = 1200; // Visual tuning: a brief count-up rather than a long wait.

/** Animates a finite metric; screen readers and reduced motion receive only the final value. */
export function NumberTicker({
  value,
  format = (current) => Math.round(current).toLocaleString('en-GB'),
}: {
  value: number;
  format?: (value: number) => string;
}) {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (reduce || !element || typeof IntersectionObserver === 'undefined') return;
    let frame = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      let start: number | undefined;
      const update = (now: number) => {
        start ??= now;
        const progress = Math.min(1, (now - start) / DURATION_MS);
        // Cubic ease-out slows as the final value approaches.
        setDisplay(value * (1 - (1 - progress) ** 3));
        if (progress < 1) frame = requestAnimationFrame(update);
      };
      setDisplay(0);
      frame = requestAnimationFrame(update);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, reduce]);
  return (
    <span ref={ref} className="font-mono tabular-nums">
      <span aria-hidden="true">{format(display ?? value)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
