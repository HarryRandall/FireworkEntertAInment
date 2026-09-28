/**
 * Tiny isomorphic utility helpers shared across the app. Add new helpers here
 * only when they are truly generic (no Next, Supabase, or domain coupling).
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

/** Constrain `value` to `[min, max]`; defaults to the unit interval. */
export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Plain object check for parsed JSON and other `unknown` input; arrays are excluded. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
