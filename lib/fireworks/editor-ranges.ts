export type NumericRange = [number, number];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Build a symmetric editor range without ever emitting negative speed or life values. */
export function nonNegativeRangeFromMidpoint(midpoint: number, halfWidth: number): NumericRange {
  const safeMidpoint = Number.isFinite(midpoint) ? Math.max(0, midpoint) : 0;
  const safeHalfWidth = Number.isFinite(halfWidth) ? Math.max(0, halfWidth) : 0;
  return [
    round2(Math.max(0, safeMidpoint - safeHalfWidth)),
    round2(Math.max(0, safeMidpoint + safeHalfWidth)),
  ];
}
