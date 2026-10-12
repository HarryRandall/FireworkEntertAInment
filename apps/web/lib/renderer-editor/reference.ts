/** Reference clips follow the preview clock, offset to the moment the real firework fires. */

/** A local clip chosen for side-by-side comparison; nothing is uploaded. */
export interface ReferenceClip {
  url: string;
  name: string;
  /** Seconds into the clip where the firework is lit, so both start together. */
  offsetS: number;
}

/** Maps preview seconds to clip seconds, clamped to the clip; no inputs are changed. */
export function referenceTime(timeS: number, durationS: number, offsetS = 0): number {
  if (!Number.isFinite(durationS)) return Math.max(0, timeS + offsetS);
  return Math.max(0, Math.min(durationS, timeS + offsetS));
}
