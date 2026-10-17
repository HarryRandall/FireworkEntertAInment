/**
 * Shared density rules for sustained layers (cakes and long ground effects).
 *
 * Every planner used to treat a cake as a half-second ignition, so different
 * cake products stacked on top of each other at every pulse and a quiet intro
 * could carry a dozen simultaneous beds. These helpers describe how many
 * layers a passage can carry, how long a layer really stays visible, and keep
 * a ledger of active layers so planners share one deterministic answer.
 */
import type { CueSlot } from '@/lib/beat-grid.server';
import type { ProductTimingProfile } from '@/lib/fireworks/timing-profile';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { DensityLevel } from './show-plan';
import { isGroundEffect } from './show-options';

/** How busy a passage of music is, from a quiet intro to the final chorus. */
export type DensityPhase = 'quiet' | 'sparse' | 'moderate' | 'busy' | 'peak';

/**
 * Site-wide limits per phase: how many sustained layers may be visible at
 * once and how many shots per second those layers may add up to.
 */
export const PHASE_LIMITS: Readonly<
  Record<DensityPhase, { activeLayers: number; shotRate: number }>
> = {
  quiet: { activeLayers: 1, shotRate: 1.25 },
  sparse: { activeLayers: 1, shotRate: 2.5 },
  moderate: { activeLayers: 2, shotRate: 4.5 },
  busy: { activeLayers: 2, shotRate: 6.5 },
  peak: { activeLayers: 3, shotRate: 9 },
};

const PHASE_ORDER: readonly DensityPhase[] = ['quiet', 'sparse', 'moderate', 'busy', 'peak'];

/** A volley whose firing finishes sooner than this reads as an accent rather than a bed. */
const MIN_SUSTAINED_SECONDS = 4;
/** Multishots with at least this many shots consume density capacity however fast they fire. */
const DENSE_VOLLEY_SHOTS = 8;
/** A cake with no timing data still occupies its position for a while. */
const DEFAULT_SUSTAINED_SECONDS = 8;
/** The last burst may fade past the music, but nothing may still be firing then. */
const FINAL_FADE_ALLOWANCE_SECONDS = 4;

export type SustainedLayer = {
  productId: string;
  tube: number;
  start: number;
  end: number;
  /** Shots per second across the layer's visible life. */
  shotRate: number;
};

export type LayerStartOptions = {
  /** Maximum layers visible at once across the whole site. */
  activeLimit: number;
  /** Maximum summed shots per second, or null when physical packs make rate irrelevant. */
  shotRateLimit: number | null;
};

export function comparePhases(a: DensityPhase, b: DensityPhase): number {
  return PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b);
}

/** Sustained layers never exceed the launch positions available. */
export function sustainedLayerLimit(phase: DensityPhase, maxTubes: number): number {
  return Math.max(1, Math.min(maxTubes, PHASE_LIMITS[phase].activeLayers));
}

type LayerTiming = Pick<
  ProductTimingProfile,
  'totalDurationSeconds' | 'firstImpactOffsetSeconds' | 'lastImpactOffsetSeconds'
>;

/** Seconds between a product's first and last firing, when anything records it. */
function firingSpanSeconds(
  product: Pick<FireworkSpecification, 'durationSeconds'>,
  profile?: Partial<LayerTiming> | null,
): number | null {
  if (profile?.firstImpactOffsetSeconds != null && profile?.lastImpactOffsetSeconds != null) {
    return Math.max(0, profile.lastImpactOffsetSeconds - profile.firstImpactOffsetSeconds);
  }
  return product.durationSeconds ?? null;
}

/**
 * Whether a product consumes density capacity as a layer. A light volley that
 * fires out within a few seconds is a beat accent like a shell, but a dense
 * one (many shots however briefly) fills the sky and the sound stage just the
 * same as a long cake, and a cake of unknown length is assumed to run a while.
 */
export function isSustainedProduct(
  product: Pick<FireworkSpecification, 'shotCount' | 'kind' | 'durationSeconds'>,
  profile?: Partial<LayerTiming> | null,
): boolean {
  const shots = product.shotCount ?? 1;
  if (shots > 1) {
    if (shots >= DENSE_VOLLEY_SHOTS) return true;
    const span = firingSpanSeconds(product, profile);
    return span == null || span >= MIN_SUSTAINED_SECONDS;
  }
  if (!isGroundEffect(product)) return false;
  const duration = profile?.totalDurationSeconds ?? product.durationSeconds;
  return duration != null && duration >= MIN_SUSTAINED_SECONDS;
}

/** How long a layer stays visible from ignition, using real firing timing when known. */
export function sustainedLayerSeconds(
  product: Pick<FireworkSpecification, 'durationSeconds'>,
  profile?: Partial<Pick<LayerTiming, 'totalDurationSeconds'>> | null,
): number {
  const duration = profile?.totalDurationSeconds ?? product.durationSeconds;
  return duration != null && Number.isFinite(duration) && duration > 0
    ? duration
    : DEFAULT_SUSTAINED_SECONDS;
}

/**
 * Whether a product ignited at `launchTimeSeconds` finishes with the music:
 * its last burst lands inside the song and its tail fades within the
 * allowance. A show that keeps firing a cake long after the song has ended
 * reads as a timing fault, not a finale.
 */
export function finishesWithSong(params: {
  product: Pick<FireworkSpecification, 'shotCount' | 'durationSeconds'>;
  profile?: Partial<LayerTiming> | null;
  launchTimeSeconds: number;
  songDuration: number;
}): boolean {
  const { product, profile, launchTimeSeconds, songDuration } = params;
  if (profile?.lastImpactOffsetSeconds != null) {
    if (launchTimeSeconds + profile.lastImpactOffsetSeconds > songDuration) return false;
  }
  const total = profile?.totalDurationSeconds ?? product.durationSeconds;
  if (total != null && Number.isFinite(total)) {
    if (launchTimeSeconds + total > songDuration + FINAL_FADE_ALLOWANCE_SECONDS) return false;
  } else if ((product.shotCount ?? 1) > 1) {
    // A cake of unknown length is assumed to run its default layer time.
    if (launchTimeSeconds + DEFAULT_SUSTAINED_SECONDS > songDuration + FINAL_FADE_ALLOWANCE_SECONDS)
      return false;
  }
  return true;
}

/**
 * Shots per second while the product is firing: a sixty-shot cake emptied in
 * two seconds is a far denser layer than one paced over half a minute.
 */
export function sustainedShotRate(
  product: Pick<FireworkSpecification, 'shotCount' | 'durationSeconds'>,
  profile?: Partial<LayerTiming> | null,
): number {
  const shots = Math.max(1, product.shotCount ?? 1);
  const span = firingSpanSeconds(product, profile) ?? sustainedLayerSeconds(product, profile);
  return shots / Math.max(1, span);
}

/**
 * Tracks layers already placed so a candidate can be checked against every
 * instant it would share with them. Planners that backtrack use `size` and
 * `truncate` to roll back in step with their other bookkeeping.
 */
export class SustainedLayerLedger {
  private layers: SustainedLayer[] = [];

  get size(): number {
    return this.layers.length;
  }

  truncate(size: number): void {
    this.layers.length = Math.max(0, Math.min(this.layers.length, size));
  }

  add(layer: SustainedLayer): void {
    this.layers.push(layer);
  }

  activeAt(time: number): SustainedLayer[] {
    return this.layers.filter((layer) => layer.start <= time && time < layer.end);
  }

  /** The layer occupying this position at `time`, if any. */
  occupying(tube: number, time: number): SustainedLayer | null {
    return (
      this.layers.find((layer) => layer.tube === tube && layer.start <= time && time < layer.end) ??
      null
    );
  }

  /**
   * A new layer needs a free launch position for its whole life and must keep
   * the site under the phase's concurrency and shot-rate limits at its own
   * start and at every later start inside its window. The rate limit bounds
   * how layers stack: a layer running alone is admissible however dense, so a
   * catalogue of dense cakes can still fill a show, and planners decide
   * whether such a product belongs in a quiet passage when ranking it.
   */
  canStart(candidate: SustainedLayer, options: LayerStartOptions): boolean {
    const overlapping = this.layers.filter(
      (layer) => candidate.start < layer.end && layer.start < candidate.end,
    );
    if (overlapping.some((layer) => layer.tube === candidate.tube)) return false;
    const checkpoints = [
      candidate.start,
      ...overlapping.map((layer) => layer.start).filter((start) => start > candidate.start),
    ];
    for (const time of checkpoints) {
      const active = overlapping.filter((layer) => layer.start <= time && time < layer.end);
      if (active.length + 1 > options.activeLimit) return false;
      if (options.shotRateLimit != null && active.length > 0) {
        const rate = active.reduce((sum, layer) => sum + layer.shotRate, candidate.shotRate);
        if (rate > options.shotRateLimit) return false;
      }
    }
    return true;
  }
}

/**
 * Planned density may not exceed what the music can carry: a near-silent
 * passage holds one bar-level pulse at most, a quiet one half-bar pulses.
 */
export function energyDensityCeiling(energy: number): DensityLevel {
  if (energy < 0.12) return 1;
  if (energy < 0.3) return 2;
  return 4;
}

type PhaseDirection = {
  role: 'opener' | 'body' | 'lull' | 'build' | 'peak' | 'finale' | 'outro';
  density: DensityLevel;
};

/** Phase for a plan section, from its creative role, density and measured energy. */
export function sectionDensityPhase(
  direction: PhaseDirection,
  section: { energy: number },
  progress: number,
): DensityPhase {
  const { role, density } = direction;
  const energy = section.energy;
  switch (role) {
    case 'finale':
      return 'peak';
    case 'peak':
      return density >= 3 ? 'peak' : 'busy';
    case 'build':
      return progress >= 2 / 3 ? 'busy' : 'moderate';
    case 'body':
      return density >= 3 ? 'busy' : density === 2 ? 'moderate' : 'sparse';
    case 'opener':
      if (energy < 0.15) return 'quiet';
      return density >= 2 && energy >= 0.3 ? 'moderate' : 'sparse';
    case 'lull':
    case 'outro':
      return energy < 0.15 || density === 0 ? 'quiet' : 'sparse';
  }
}

/** Phase for a beat-grid slot, from its analysed vibe and local intensity. */
export function slotDensityPhase(
  slot: Pick<CueSlot, 'vibe' | 'intensity' | 'nearClimax' | 'finale'>,
): DensityPhase {
  if (slot.finale || slot.nearClimax) return 'peak';
  switch (slot.vibe) {
    case 'intro':
    case 'outro':
      return slot.intensity < 0.35 ? 'quiet' : 'sparse';
    case 'verse':
    case 'bridge':
      return slot.intensity >= 0.6 ? 'moderate' : 'sparse';
    case 'pre-chorus':
    case 'buildup':
      return 'moderate';
    case 'chorus':
    case 'drop':
      return 'busy';
  }
}
