/**
 * Wrapper that visually hides inactive wizard steps without unmounting their
 * inputs. Keeping the panels mounted preserves typed values when the user
 * clicks Back, which is what most users expect from a wizard.
 */
'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StepPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <section className={cn(!active && 'hidden')}>{children}</section>;
}
