import { estimateFireworkDesignTiming } from '../timing.ts';
import type { FireworkDesign, FireworkStarLayer } from './schema.ts';
import { MAX_STAR_COUNT } from './schema.ts';

export const CALIBER_BASELINE_MM = 30;

export function parseCaliberMm(caliber: string): number | null {
  const mm = caliber.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
  if (mm) return parseFloat(mm[1]);
  const inches = caliber.match(/^(\d+(?:\.\d+)?)\s*["""]/);
  if (inches) return parseFloat(inches[1]) * 25.4;
  return null;
}

export function scaleDesignForCaliber(
  design: FireworkDesign,
  caliber: string | null,
): FireworkDesign {
  if (!caliber) return design;
  const mm = parseCaliberMm(caliber);
  if (!mm) return design;
  const scale = mm / CALIBER_BASELINE_MM;
  const scaleLayer = (layer: FireworkStarLayer): FireworkStarLayer => ({
    ...layer,
    count: Math.round(Math.max(1, Math.min(MAX_STAR_COUNT, layer.count * scale))),
    burst: {
      ...layer.burst,
      speed: [layer.burst.speed[0] * scale, layer.burst.speed[1] * scale],
    },
  });
  const outer = scaleLayer(design.stars.outer);
  const core = scaleLayer(design.stars.core);
  return {
    ...design,
    size: outer.count,
    burst: outer.burst,
    burstTrail: outer.burstTrail,
    stars: { outer, core },
  };
}

/**
 * Per-cue render emphasis (schema 1.4.0). Climaxes, drops and finale beats get
 * visibly bigger and brighter shells without changing the underlying product:
 * more stars (capped at {@link MAX_STAR_COUNT}), faster/wider bursts, and a
 * higher launch. `size` drives the burst flash in `Lights`, so scaling it also
 * brightens the flash for free.
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
    count: Math.round(Math.max(1, Math.min(MAX_STAR_COUNT, layer.count * scale))),
    burst: {
      ...layer.burst,
      speed: [layer.burst.speed[0] * scale, layer.burst.speed[1] * scale],
    },
  });
  const outer = scaleLayer(design.stars.outer);
  const core = scaleLayer(design.stars.core);
  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  return {
    ...design,
    size: outer.count,
    burst: outer.burst,
    burstTrail: outer.burstTrail,
    stars: { outer, core },
    liftVelocity: liftVelocity * scale,
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
