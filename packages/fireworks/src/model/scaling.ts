import { estimateFireworkDesignTiming } from '../timing.ts';
import type { FireworkDesign, FireworkStarLayer } from './schema.ts';
import { MAX_STAR_COUNT, MAX_FOUNTAIN_RATE, MAX_BURST_FLASH_INTENSITY } from './schema.ts';

export const CALIBER_BASELINE_MM = 30;

export function parseCaliberMm(caliber: string): number | null {
  const mm = caliber.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
  if (mm) return parseFloat(mm[1]);
  const inches = caliber.match(/^(\d+(?:\.\d+)?)\s*(?:["\u201D\u2033]|in\b|inch)/i);
  if (inches) return parseFloat(inches[1]) * 25.4;
  return null;
}

/**
 * How a shell grows with calibre, relative to {@link CALIBER_BASELINE_MM}.
 * Real break height and spread grow roughly in proportion to calibre, which
 * would put a 150 mm shell far out of frame beside a 30 mm cake. These
 * exponents keep the proportions believable (bigger shells break higher,
 * wider, denser and hang longer) while a whole show stays in one frame.
 */
export const CALIBER_SCALING = {
  /** Break height: lift velocity scales by half this, as height grows with v^2. */
  height: 0.35,
  /** Burst radius, through star speed. */
  spread: 0.5,
  /** Star count and emission rate. */
  stars: 0.8,
  /** Star burn time. */
  life: 0.2,
  /** Scene flash brightness. */
  flash: 0.5,
} as const;

export function scaleDesignForCaliber(
  design: FireworkDesign,
  caliber: string | null,
): FireworkDesign {
  if (!caliber) return design;
  const mm = parseCaliberMm(caliber);
  if (!mm) return design;
  const ratio = mm / CALIBER_BASELINE_MM;
  const factor = (exponent: number) => Math.pow(ratio, exponent);
  const spread = factor(CALIBER_SCALING.spread);
  const stars = factor(CALIBER_SCALING.stars);
  const life = factor(CALIBER_SCALING.life);
  const lift = factor(CALIBER_SCALING.height / 2);
  const scaleLayer = (layer: FireworkStarLayer): FireworkStarLayer => ({
    ...layer,
    emissionRate: Math.max(1, Math.min(MAX_FOUNTAIN_RATE, layer.emissionRate * stars)),
    count: Math.round(Math.max(1, Math.min(MAX_STAR_COUNT, layer.count * stars))),
    burst: {
      ...layer.burst,
      speed: [layer.burst.speed[0] * spread, layer.burst.speed[1] * spread],
      life: [Math.min(30, layer.burst.life[0] * life), Math.min(30, layer.burst.life[1] * life)],
    },
  });
  const outer = scaleLayer(design.stars.outer);
  const core = scaleLayer(design.stars.core);
  return {
    ...design,
    burst: outer.burst,
    burstTrail: outer.burstTrail,
    stars: { outer, core },
    burstFlashIntensity: Math.min(
      MAX_BURST_FLASH_INTENSITY,
      design.burstFlashIntensity * factor(CALIBER_SCALING.flash),
    ),
    liftVelocity: design.liftVelocity * lift,
    shellLife: Math.min(60, design.shellLife * lift),
  };
}

/**
 * Per-cue render emphasis (schema 1.4.0). Climaxes, drops and finale beats get
 * visibly bigger and brighter shells without changing the underlying product:
 * more stars (capped at {@link MAX_STAR_COUNT}), faster/wider bursts, and a
 * higher launch. Scene flash intensity scales explicitly, independently of
 * the capped star count.
 */
export const EMPHASIS_SCALE: Record<'normal' | 'accent' | 'peak', number> = {
  normal: 1.0,
  accent: 1.2,
  peak: 1.5,
};

export function scaleDesignForEmphasis(
  design: FireworkDesign,
  emphasis: 'normal' | 'accent' | 'peak' | null | undefined,
): FireworkDesign {
  if (!emphasis || emphasis === 'normal') return design;
  const scale = EMPHASIS_SCALE[emphasis];
  const scaleLayer = (layer: FireworkStarLayer): FireworkStarLayer => ({
    ...layer,
    emissionRate: Math.max(1, Math.min(MAX_FOUNTAIN_RATE, layer.emissionRate * scale)),
    count: Math.round(Math.max(1, Math.min(MAX_STAR_COUNT, layer.count * scale))),
    burst: {
      ...layer.burst,
      speed: [layer.burst.speed[0] * scale, layer.burst.speed[1] * scale],
    },
  });
  const outer = scaleLayer(design.stars.outer);
  const core = scaleLayer(design.stars.core);
  const liftVelocity = design.liftVelocity;
  return {
    ...design,
    burst: outer.burst,
    burstTrail: outer.burstTrail,
    stars: { outer, core },
    burstFlashIntensity: Math.min(MAX_BURST_FLASH_INTENSITY, design.burstFlashIntensity * scale),
    liftVelocity: liftVelocity * scale,
    // A faster lift needs a proportionally longer fuse to reach its apex.
    shellLife: Math.min(60, design.shellLife * scale),
  };
}

/**
 * Estimate how long a single shell takes from launch to the last particle
 * fading, in seconds. Mirrors the particle physics in `Particle.update`
 * (quadratic drag, gravity, shell mass 0.5) closely enough for preview
 * timelines; it does not need to be frame-exact.
 */
export function estimateDesignDurationSeconds(design: FireworkDesign, panDegrees = 0): number {
  return estimateFireworkDesignTiming(design, panDegrees).endSeconds;
}
