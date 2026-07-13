import type { FireworkDesign, FireworkStarLayer } from './design';

export type FireworkDesignTiming = {
  liftTimeSeconds: number;
  effectStartSeconds: number;
  fadeStartSeconds: number;
  fadeFinishSeconds: number;
  endSeconds: number;
};

function rangeMin(range: [number, number]): number {
  return Math.min(range[0], range[1]);
}

function rangeMax(range: [number, number]): number {
  return Math.max(range[0], range[1]);
}

function closingFadePercent(layer: FireworkStarLayer): number {
  const { closing } = layer.head;
  const fadePercents = [
    closing.colour.enabled ? closing.colour.fadePercent : null,
    closing.size.enabled ? closing.size.shrinkPercent : null,
    // The renderer holds head brightness until roughly the final 18% of life.
    18,
  ].filter((value): value is number => value != null);

  return Math.max(...fadePercents);
}

function isGroundEffect(design: FireworkDesign): boolean {
  return (
    design.geometry === 'upward_fan' ||
    design.geometry === 'roman_candle' ||
    design.geometry === 'fountain'
  );
}

export function estimateFireworkLiftTimeSeconds(design: FireworkDesign): number {
  if (isGroundEffect(design)) return 0;

  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  const dragK = 0.5 * 0.47 * 1.22 * (Math.PI / 10000);
  const shellMass = 0.5;
  const dt = 1 / 60;
  let vy = liftVelocity * 0.96;
  let liftTime = 0;

  while (vy > 0 && liftTime < design.shellLife) {
    vy += ((-dragK * vy * Math.abs(vy)) / shellMass) * dt;
    vy += -9.82 * dt;
    liftTime += dt;
  }

  return liftTime;
}

function emittedDurationSeconds(design: FireworkDesign): number {
  if (design.geometry === 'roman_candle') {
    const shape = design.geometryTuning.romanCandle;
    return Math.max(
      shape.durationMinSeconds,
      Math.min(shape.durationMaxSeconds, design.shellLife * (shape.durationPercent / 100)),
    );
  }

  if (design.geometry === 'fountain') {
    const shape = design.geometryTuning.fountain;
    return Math.max(
      shape.durationMinSeconds,
      Math.min(shape.durationMaxSeconds, design.shellLife * (shape.durationPercent / 100)),
    );
  }

  return 0;
}

function geometryLifeBounds(
  design: FireworkDesign,
  layer: FireworkStarLayer,
): { min: number; max: number } {
  const minLife = rangeMin(layer.burst.life);
  const maxLife = rangeMax(layer.burst.life);
  const tuning = design.geometryTuning;

  switch (design.geometry) {
    case 'weeping': {
      const scale = tuning.weeping.lifePercent / 100;
      return { min: minLife * scale, max: maxLife * (scale + 0.35) };
    }
    case 'falling_tail': {
      const scale = tuning.fallingTail.lifePercent / 100;
      return { min: minLife * scale, max: maxLife * (scale + 0.35) };
    }
    case 'waterfall': {
      const scale = tuning.waterfall.lifePercent / 100;
      return { min: minLife * scale, max: maxLife * scale };
    }
    case 'pearls': {
      const scale = tuning.pearls.lifePercent / 100;
      return { min: minLife * scale, max: maxLife * scale };
    }
    case 'ring': {
      const scale = tuning.ring.lifePercent / 100;
      return { min: minLife * scale, max: maxLife * scale };
    }
    case 'single_tail': {
      const scale = tuning.singleTail.lifePercent / 100;
      return { min: minLife * scale, max: maxLife * scale };
    }
    case 'upward_fan': {
      const scale = tuning.upwardFan.lifePercent / 100;
      return { min: minLife * scale, max: maxLife * scale };
    }
    case 'roman_candle': {
      const scale = tuning.romanCandle.lifePercent / 100;
      return { min: minLife * scale, max: maxLife * scale };
    }
    case 'fountain': {
      const scale = tuning.fountain.lifePercent / 100;
      return { min: minLife * scale, max: maxLife * scale };
    }
    case 'fish':
      return {
        min: tuning.fish.lifeBaseSeconds,
        max: tuning.fish.lifeBaseSeconds + tuning.fish.lifeVariationSeconds,
      };
    case 'whirl':
      return {
        min: tuning.whirl.lifeBaseSeconds,
        max: tuning.whirl.lifeBaseSeconds + tuning.whirl.lifeVariationSeconds,
      };
    default:
      return { min: minLife, max: maxLife };
  }
}

function geometryTrailLifeScale(design: FireworkDesign): number {
  switch (design.geometry) {
    case 'single_tail':
      return design.geometryTuning.singleTail.trailLifePercent / 100;
    case 'upward_fan':
      return design.geometryTuning.upwardFan.trailLifePercent / 100;
    case 'roman_candle':
      return design.geometryTuning.romanCandle.trailLifePercent / 100;
    case 'fountain':
      return design.geometryTuning.fountain.trailLifePercent / 100;
    case 'fish':
      return design.geometryTuning.fish.trailLifePercent / 100;
    case 'whirl':
      return design.geometryTuning.whirl.trailLifePercent / 100;
    default:
      return 1;
  }
}

function geometrySupportsSplit(design: FireworkDesign): boolean {
  return ![
    'single_tail',
    'fish',
    'waterfall',
    'whirl',
    'upward_fan',
    'roman_candle',
    'fountain',
  ].includes(design.geometry);
}

function launchTrailEndSeconds(design: FireworkDesign, liftTimeSeconds: number): number {
  const liftParticles = design.launch.liftParticles;
  if (!liftParticles.enabled || liftParticles.amount <= 0) return liftTimeSeconds;

  const emissionEnd = liftTimeSeconds * Math.min(1, Math.max(0, liftParticles.height / 100));
  const lifeVariation = 1 + Math.min(1, Math.max(0, liftParticles.lifetime.variationPercent / 100));
  const particleLife =
    (liftParticles.lifetime.baseSeconds + liftParticles.lifetime.afterglowSeconds) *
    lifeVariation *
    Math.max(0.2, design.trail.length);

  return emissionEnd + particleLife;
}

/**
 * Estimate the visible phases of one firework from launch. The helper mirrors
 * renderer life and emitter settings so transport limits and timeline ticks
 * expand with admin geometry tuning instead of clipping long effects.
 */
export function estimateFireworkDesignTiming(design: FireworkDesign): FireworkDesignTiming {
  const activeLayers = [design.stars.outer, design.stars.core].filter((layer) => layer.enabled);
  const layers = activeLayers.length > 0 ? activeLayers : [design.stars.outer];
  const lifeBounds = layers.map((layer) => geometryLifeBounds(design, layer));
  const liftTimeSeconds = estimateFireworkLiftTimeSeconds(design);
  const effectStartSeconds = liftTimeSeconds;
  const emissionDuration = emittedDurationSeconds(design);
  const minFadeOffset = Math.min(
    ...layers.map((layer, index) => {
      const visibleLife = lifeBounds[index].min;
      return visibleLife * (1 - closingFadePercent(layer) / 100);
    }),
  );
  const maxHeadLife = Math.max(...lifeBounds.map((bounds) => bounds.max));
  const fadeStartSeconds = effectStartSeconds + Math.max(0, minFadeOffset);
  const fadeFinishSeconds = effectStartSeconds + emissionDuration + maxHeadLife;

  const splitEndSeconds =
    design.split.enabled && geometrySupportsSplit(design)
      ? effectStartSeconds +
        maxHeadLife * design.split.delayRatio +
        design.split.lifeBaseSeconds +
        design.split.lifeVariationSeconds
      : fadeFinishSeconds;
  const crackleEndSeconds =
    design.crackle.enabled && design.crackle.probability > 0
      ? fadeFinishSeconds + 1.3
      : fadeFinishSeconds;
  const geometryTrailScale = geometryTrailLifeScale(design);
  const trailEndSeconds = Math.max(
    fadeFinishSeconds,
    ...layers.map((layer, index) => {
      if (!layer.burstTrail.enabled || layer.burstTrail.particlesPerStar <= 0) {
        return fadeFinishSeconds;
      }
      const lifeMultiplier = Math.min(2, Math.max(0, layer.burstTrail.lifetime.percent));
      const randomBoost =
        1 + Math.min(1, Math.max(0, layer.burstTrail.lifetime.variationPercent / 100));
      const trailLife = lifeBounds[index].max * lifeMultiplier * randomBoost * geometryTrailScale;
      return effectStartSeconds + emissionDuration + Math.max(lifeBounds[index].max, trailLife);
    }),
  );
  const liftTrailEndSeconds = launchTrailEndSeconds(design, liftTimeSeconds);

  return {
    liftTimeSeconds,
    effectStartSeconds,
    fadeStartSeconds,
    fadeFinishSeconds,
    endSeconds: Math.max(
      fadeFinishSeconds,
      splitEndSeconds,
      crackleEndSeconds,
      trailEndSeconds,
      liftTrailEndSeconds,
    ),
  };
}
