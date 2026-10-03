/** Magic UI number ticker using browser frames and a reduced-motion subscription. */
'use client';
import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

const DURATION_MS = 800; // Visual tuning: a brief count-up rather than a long wait.
/** Animates a finite numeric metric over wall-clock milliseconds; screen readers receive only the final value. */
export function NumberTicker({
  value,
  format = String,
}: {
  value: number;
  format?: (value: number) => string;
}) {
  const reduce = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (reduce) {
      return;
    }
    let frame = 0;
    let start: number | undefined;
    function update(now: number) {
      start ??= now;
      const progress = Math.min(1, (now - start) / DURATION_MS);
      // Quadratic ease-out slows as the final metric approaches.
      const eased = 1 - (1 - progress) ** 2;
      setDisplay(value * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(update);
      }
    }
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [value, reduce]);
  return (
    <span className="font-mono tabular-nums">
      <span aria-hidden="true">{format(reduce ? value : display)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
