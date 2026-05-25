/**
 * Deterministic seeded RNG used by the renderer.
 *
 * Cue rendering must be reproducible (same show + same seed = same visuals)
 * so we never use `Math.random()` directly inside effects. Seeds come from
 * {@link hashStringToSeed} of either the cue id or a manual override.
 */

export type SeededRng = {
  next: () => number;
  range: (min: number, max: number) => number;
  signed: (amount?: number) => number;
  int: (min: number, max: number) => number;
};

export type RandomSource = Pick<SeededRng, 'next'>;

export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mixSeed(...values: Array<number | string | undefined | null>): number {
  return hashStringToSeed(values.map((value) => (value == null ? '' : String(value))).join(':'));
}

export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;

  const next = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    signed: (amount = 1) => (next() * 2 - 1) * amount,
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
  };
}
