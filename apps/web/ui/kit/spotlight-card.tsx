/** A surface whose hover glow follows the pointer; fine pointers only. */
'use client';
import type { PointerEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Writes the pointer position to CSS variables read by `.sc-spotlight` in kit.css. */
function trackPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return;
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  element.style.setProperty('--sc-x', `${event.clientX - rect.left}px`);
  element.style.setProperty('--sc-y', `${event.clientY - rect.top}px`);
}

/** Wraps content in a bordered card with a soft pointer-following highlight. */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      onPointerMove={trackPointer}
      className={cn('sc-spotlight bg-card relative isolate overflow-hidden', className)}
    >
      {children}
    </div>
  );
}
