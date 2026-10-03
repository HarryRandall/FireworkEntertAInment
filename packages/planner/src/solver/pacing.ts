// Energy targets describe a gentle opening and a progressive finale, or the supplied audio.
import type { PlannerInput, PlannerProduct } from './input.ts';
import type { PlanMood } from './types.ts';
import { MS_PER_MINUTE, MS_PER_SECOND } from './config.ts';
import { GENERATED_LAUNCH_INTERVAL_SECONDS } from '../timing/launch-spacing.ts';

// The shared independent-ignition interval converted from seconds to millisecond clocks.
const MIN_LAUNCH_SPACING_MS = GENERATED_LAUNCH_INTERVAL_SECONDS * MS_PER_SECOND;

// Product judgements on the normalised energy scale: each mood has its own opening and finale.
const GENTLE_OPENING = 0.15;
const GENTLE_FINALE = 0.55;
const BALANCED_OPENING = 0.3;
const BALANCED_FINALE = 0.85;
const BIG_OPENING = 0.35;
const MOOD_ENERGY = {
  gentle: [GENTLE_OPENING, GENTLE_FINALE],
  balanced: [BALANCED_OPENING, BALANCED_FINALE],
  big_finale: [BIG_OPENING, 1],
} as const;
// Prototype-inspired visual overlap: gentle/balanced start the next unit after 90%/80% of the previous display.
const GENTLE_SPACING = 0.9;
const BALANCED_SPACING = 0.8;
const FINALE_SPACING = 0.7;
const DISPLAY_SPACING = {
  gentle: GENTLE_SPACING,
  balanced: BALANCED_SPACING,
  big_finale: FINALE_SPACING,
};
// Requested length gets half the pacing score; energy trajectory gets the other half.
const LENGTH_SHARE = 0.5;

/** Target show length in milliseconds, capped by the selected audio's real duration. */
export function targetDuration(input: PlannerInput): number {
  const requested = input.answers.length_min * MS_PER_MINUTE;
  return Math.min(requested, (input.music?.duration_seconds ?? Infinity) * MS_PER_SECOND);
}

/** Returns the normalised target energy at progress zero to one; audio clocks start at zero seconds. */
export function targetEnergy(input: PlannerInput, mood: PlanMood, progress: number): number {
  const music = input.music;
  if (music === null) {
    const [opening, finale] = MOOD_ENERGY[mood];
    return opening + (finale - opening) * progress;
  }
  const time = (progress * targetDuration(input)) / MS_PER_SECOND;
  return audioEnergy(music, time, MOOD_ENERGY[mood][1]);
}

function audioEnergy(
  music: NonNullable<PlannerInput['music']>,
  time: number,
  fallback: number,
): number {
  const energy = music.energy_timeline;
  const after = energyLowerBound(energy, time);
  const right = energy[after];
  const left = energy[Math.max(0, after - 1)];
  if (right !== undefined && (left === undefined || right.time <= left.time)) {
    return right.energy;
  }
  if (left !== undefined && right !== undefined) {
    const fraction = (time - left.time) / (right.time - left.time);
    return left.energy + (right.energy - left.energy) * fraction;
  }
  return fallbackAudioEnergy(music, time, fallback);
}

/** Sequential display advance in milliseconds; ignitions still obey the independent-position interval. */
export function displayAdvance(product: PlannerProduct, mood: PlanMood): number {
  return Math.max(MIN_LAUNCH_SPACING_MS, Math.round(product.duration_ms * DISPLAY_SPACING[mood]));
}

/** Combines length fit and per-unit energy fit in a bounded dimensionless pacing score. */
export function pacingScore(
  products: PlannerProduct[],
  duration: number,
  input: PlannerInput,
  mood: PlanMood,
): number {
  const lengthFit = Math.min(duration / targetDuration(input), targetDuration(input) / duration);
  const mismatch =
    products.reduce((sum, product, index) => {
      const progress = products.length === 1 ? 1 : index / (products.length - 1);
      return sum + Math.abs(product.energy - targetEnergy(input, mood, progress));
    }, 0) / products.length;
  return LENGTH_SHARE * lengthFit + (1 - LENGTH_SHARE) * (1 - mismatch);
}

function energyLowerBound(
  energy: NonNullable<PlannerInput['music']>['energy_timeline'],
  time: number,
): number {
  let low = 0;
  let high = energy.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((energy[middle]?.time ?? Infinity) < time) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function fallbackAudioEnergy(
  music: NonNullable<PlannerInput['music']>,
  time: number,
  fallback: number,
): number {
  if (music.energy_timeline.length > 0) {
    return music.energy_timeline.at(-1)?.energy ?? fallback;
  }
  const section = music.sections.find((item) => time >= item.start && time <= item.end);
  return section?.avg_energy ?? fallback;
}

/** Orders whole units against the default/audio energy trajectory without mutating the input assortment. */
export function arrangeProducts(
  products: PlannerProduct[],
  input: PlannerInput,
  mood: PlanMood,
): PlannerProduct[] {
  const remaining = [...products];
  if (input.music === null) {
    return remaining;
  }
  const arranged: PlannerProduct[] = [];
  for (let index = 0; index < products.length; index += 1) {
    const progress = products.length === 1 ? 1 : index / (products.length - 1);
    const target = targetEnergy(input, mood, progress);
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let candidate = 0; candidate < remaining.length; candidate += 1) {
      const unit = remaining[candidate];
      if (unit === undefined) {
        continue;
      }
      const distance = Math.abs(unit.energy - target);
      if (distance < bestDistance) {
        bestIndex = candidate;
        bestDistance = distance;
      }
    }
    const chosen = remaining.splice(bestIndex, 1)[0];
    if (chosen !== undefined) {
      arranged.push(chosen);
    }
  }
  return arranged;
}
