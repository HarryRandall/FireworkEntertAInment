/** Numeric fallbacks used by the prototype's optional motion and source controls. */

/** Returns the prototype fallback for an absent, zero or NaN control; retains signed values. */
export function prototypeOr(value: number | undefined, fallback: number): number {
  if (value === undefined || value === 0 || Number.isNaN(value)) return fallback;
  return value;
}
