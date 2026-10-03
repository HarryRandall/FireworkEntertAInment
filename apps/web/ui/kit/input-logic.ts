/** Pure parsing and bounded number changes for controlled inputs. */
// IEEE-754 doubles reliably retain about fifteen decimal significant digits.
const DECIMAL_SIGNIFICANT_DIGITS = 15;

/** Splits pasted or typed tags at whitespace, commas and semicolons; preserves order and removes duplicates. */
export function parseTags(text: string, existing: readonly string[] = []): string[] {
  return [...new Set([...existing, ...text.split(/[\s,;]+/u).filter((tag) => tag.length > 0)])];
}
/** Checks the lightweight email shape used for invitation feedback, not delivery validity. */
export function isEmailTag(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text);
}
/** Changes a finite quantity by one positive step, clamped to inclusive bounds; never mutates inputs. */
export function stepValue(
  value: number,
  direction: -1 | 1,
  bounds: { min: number; max: number; step: number },
): number {
  const { min, max, step } = bounds;
  if (![value, min, max, step].every(Number.isFinite) || min > max || step <= 0) {
    throw new RangeError('Quantity needs finite ordered bounds and a positive step');
  }
  // Strip binary rounding drift while retaining tiny scientific-notation steps.
  const next = Number((value + direction * step).toPrecision(DECIMAL_SIGNIFICANT_DIGITS));
  return Math.min(max, Math.max(min, next));
}
