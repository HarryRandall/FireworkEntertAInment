/**
 * Tiny isomorphic utility helpers shared across the app.
 *
 * Currently only exports {@link cn}, the canonical Tailwind class-merger used
 * by every component. Add new helpers here only when they are truly generic
 * (no Next, Supabase, or domain coupling).
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class strings, deduplicating conflicting utilities.
 *
 * Accepts the full `clsx` palette (strings, objects, arrays, falsy values)
 * and runs the result through `tailwind-merge` so e.g. `cn('p-2', 'p-4')`
 * collapses to `p-4`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
