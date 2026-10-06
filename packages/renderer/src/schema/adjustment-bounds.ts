/** Shared saturation and integer rounding for authored adjustment controls. */
/** Saturates a scalar in its authored units between inclusive bounds without mutation. */
export function clampControl(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
/** Rounds a count to the nearest integer then saturates it between inclusive bounds. */
export function roundedControl(value: number, minimum: number, maximum: number): number {
  return clampControl(Math.round(value), minimum, maximum);
}
