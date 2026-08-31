/**
 * Wrapper that visually hides inactive wizard steps without unmounting their
 * inputs. Keeping the panels mounted preserves typed values when the user
 * clicks Back, which is what most users expect from a wizard.
 *
 * The enter animation (`step-panel-in`, defined in `globals.css`) replays
 * whenever the panel becomes active; inputs stay mounted throughout.
 */
'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StepPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <section
      className={cn(
        !active && 'hidden',
        active && 'motion-safe:animate-[step-panel-in_280ms_cubic-bezier(0.16,1,0.3,1)]',
      )}
    >
      {children}
    </section>
  );
}
