import type { FireworkDesign, FireworkStarLayer, StarLayerKey } from './design';

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
  const brightnessHoldPercent = Number.isFinite(layer.head.brightnessHoldPercent)
    ? layer.head.brightnessHoldPercent
    : 82;
  const brightnessFadePercent = 100 - Math.min(100, Math.max(0, brightnessHoldPercent));
  const fadePercents = [
    closing.colour.enabled ? closing.colour.fadePercent : null,
    closing.size.enabled ? closing.size.shrinkPercent : null,
    brightnessFadePercent,
  ].filter((value): value is number => value != null);

  return Math.max(...fadePercents);
}

export function isGroundFireworkEffect(design: FireworkDesign): boolean {
  return (
    design.geometry === 'upward_fan' ||
    design.geometry === 'roman_candle' ||
    design.geometry === 'fountain'
  );
}

export function usesLegacyLaunchLiftAppearance(design: FireworkDesign): boolean {
  const liftParticles = design.launch?.liftParticles;
  if (!liftParticles || liftParticles.appearanceMode === 'custom') return false;

  const outer = design.stars.outer;
  const hasStreakTrail =
    outer.enabled && outer.burstTrail.enabled && outer.burstTrail.particlesPerStar > 0;
  const isBrocadeCrown = design.geometry === 'crown' && design.trailProfile === 'glitter';
  return isBrocadeCrown || hasStreakTrail;
}

export function estimateFireworkLiftTimeSeconds(design: FireworkDesign, panDegrees = 0): number {
  if (isGroundFireworkEffect(design)) return 0;

  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  const panRadians = ((Number.isFinite(panDegrees) ? panDegrees : 0) * Math.PI) / 180;
  const dragK = 0.5 * 0.47 * 1.22 * (Math.PI / 10000);
  const shellMass = 0.5;
  const dt = 1 / 60;
  let vy = liftVelocity * Math.max(0.82, Math.cos(panRadians) * 0.96);
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

export function estimateFireworkLayerLifeBounds(
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

export function estimateFireworkTrailLifeScale(design: FireworkDesign): number {
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

export function estimateFireworkLaunchTrailEndSeconds(
  design: FireworkDesign,
  liftTimeSeconds = estimateFireworkLiftTimeSeconds(design),
): number {
  if (isGroundFireworkEffect(design)) return 0;
  const liftParticles = design.launch?.liftParticles;
  if (!liftParticles) return liftTimeSeconds;
  if (!liftParticles.enabled || liftParticles.amount <= 0) return liftTimeSeconds;

  const emissionEnd = liftTimeSeconds * Math.min(1, Math.max(0, liftParticles.height / 100));
  if (usesLegacyLaunchLiftAppearance(design)) {
    const streakLife = Number.isFinite(design.trail?.streakLife) ? design.trail.streakLife : 1;
    return emissionEnd + 0.38 * Math.min(4, Math.max(0.2, streakLife));
  }

  const lifeVariation = 1 + Math.min(1, Math.max(0, liftParticles.lifetime.variationPercent / 100));
  const particleLife =
    (liftParticles.lifetime.baseSeconds + liftParticles.lifetime.afterglowSeconds) *
    lifeVariation *
    Math.max(0.2, design.trail.length);

  return emissionEnd + particleLife;
}

export function estimateFireworkLaunchSmokeEndSeconds(
  design: FireworkDesign,
  liftTimeSeconds = estimateFireworkLiftTimeSeconds(design),
): number {
  const smoke = design.launch?.smoke;
  if (!smoke?.enabled || smoke.particles <= 0) return 0;

  const lifeVariationPercent = Number.isFinite(smoke.lifeVariationPercent)
    ? smoke.lifeVariationPercent
    : 0;
  const particleLife =
    smoke.lifeSeconds * (1 + Math.min(1, Math.max(0, lifeVariationPercent / 100)));

  // Every effect can emit mortar smoke at launch. Only custom aerial launches
  // continue emitting smoke during the ascent, so their final particles start
  // at the lift boundary rather than at time zero.
  const emitsDuringAscent =
    !isGroundFireworkEffect(design) && !usesLegacyLaunchLiftAppearance(design) && smoke.height > 0;

  return (emitsDuringAscent ? liftTimeSeconds : 0) + particleLife;
}

/**
 * Estimate the visible phases of one firework from launch. The helper mirrors
 * renderer life and emitter settings so transport limits and timeline ticks
 * expand with admin geometry tuning instead of clipping long effects.
 */
export function estimateFireworkDesignTiming(
  design: FireworkDesign,
  panDegrees = 0,
): FireworkDesignTiming {
  const activeLayers = [design.stars.outer, design.stars.core].filter((layer) => layer.enabled);
  const layers = activeLayers.length > 0 ? activeLayers : [design.stars.outer];
  const lifeBounds = layers.map((layer) => estimateFireworkLayerLifeBounds(design, layer));
  const liftTimeSeconds = estimateFireworkLiftTimeSeconds(design, panDegrees);
  const effectStartSeconds = liftTimeSeconds;
  const emissionDuration = emittedDurationSeconds(design);
  const minFadeOffset = Math.min(
    ...layers.map((layer, index) => {
      const visibleLife = lifeBounds[index].max;
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
  const geometryTrailScale = estimateFireworkTrailLifeScale(design);
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
  const liftTrailEndSeconds = estimateFireworkLaunchTrailEndSeconds(design, liftTimeSeconds);
  const smokeEndSeconds = estimateFireworkLaunchSmokeEndSeconds(design, liftTimeSeconds);

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
      smokeEndSeconds,
    ),
  };
}

export type FireworkTimelinePhaseKey = 'ascent' | 'burn' | 'fade' | 'tail';
export type FireworkTimelineBoundaryKey = 'ascent' | 'burn' | 'fade';
export type FireworkTimelineEditKey = FireworkTimelinePhaseKey | 'total';
export type FireworkTimelineDefaults = Record<string, unknown>;

export type FireworkEditorTimeline = {
  totalDurationSeconds: number;
  phases: Record<FireworkTimelinePhaseKey, number>;
  ascentEditable: boolean;
  tailEditable: boolean;
  crackleTailFloorSeconds: number;
};

export const MIN_TIMELINE_TOTAL_SECONDS = 1;
export const MAX_TIMELINE_TOTAL_SECONDS = 60;
export const MAX_TIMELINE_PHASE_SECONDS = 30;
export const MAX_TIMELINE_HEAD_SECONDS = 8;

const MIN_STAR_LIFE_SECONDS = 0.1;
const MAX_STAR_LIFE_SECONDS = MAX_TIMELINE_HEAD_SECONDS;
const MIN_LIFT_VELOCITY = 4;
const MAX_LIFT_VELOCITY = 40;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTimelineSeconds(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function ensureRecord(parent: FireworkTimelineDefaults, key: string): FireworkTimelineDefaults {
  const current = parent[key];
  if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
    return current as FireworkTimelineDefaults;
  }
  const next: FireworkTimelineDefaults = {};
  parent[key] = next;
  return next;
}

function activeLayerKeys(design: FireworkDesign): StarLayerKey[] {
  const active = (['outer', 'core'] as const).filter((key) => design.stars[key].enabled);
  return active.length > 0 ? active : ['outer'];
}

function normaliseRange(range: readonly number[]): [number, number] {
  const first = Number.isFinite(range[0]) ? Math.max(0, range[0] ?? 0) : 0;
  const second = Number.isFinite(range[1]) ? Math.max(0, range[1] ?? 0) : first;
  return first <= second ? [first, second] : [second, first];
}

function scaledLifeRange(range: readonly number[], scale: number): [number, number] {
  const [minimum, maximum] = normaliseRange(range);
  const nextMinimum = clamp(minimum * scale, MIN_STAR_LIFE_SECONDS, MAX_STAR_LIFE_SECONDS);
  const nextMaximum = clamp(maximum * scale, nextMinimum, MAX_STAR_LIFE_SECONDS);
  return [roundTimelineSeconds(nextMinimum), roundTimelineSeconds(nextMaximum)];
}

function setLayerLifeAndFade(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  layerKey: StarLayerKey,
  lifeScale: number,
  fadePercent: number,
): [number, number] {
  const stars = ensureRecord(defaults, 'stars');
  const layer = ensureRecord(stars, layerKey);
  const burst = ensureRecord(layer, 'burst');
  const life = scaledLifeRange(design.stars[layerKey].burst.life, lifeScale);
  burst.life = life;

  const head = ensureRecord(layer, 'head');
  head.brightnessHoldPercent = roundTimelineSeconds(100 - fadePercent);
  const closing = ensureRecord(head, 'closing');
  if (design.stars[layerKey].head.closing.colour.enabled) {
    const colour = ensureRecord(closing, 'colour');
    colour.fadePercent = roundTimelineSeconds(fadePercent);
  }
  if (design.stars[layerKey].head.closing.size.enabled) {
    const size = ensureRecord(closing, 'size');
    size.shrinkPercent = roundTimelineSeconds(fadePercent);
  }

  return life;
}

function setAbsoluteGeometryLifeScale(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  scale: number,
): void {
  if (design.geometry !== 'fish' && design.geometry !== 'whirl') return;

  const geometryTuning = ensureRecord(defaults, 'geometryTuning');
  const target = ensureRecord(geometryTuning, design.geometry);
  const current = design.geometryTuning[design.geometry];
  target.lifeBaseSeconds = roundTimelineSeconds(
    clamp(current.lifeBaseSeconds * scale, MIN_STAR_LIFE_SECONDS, MAX_STAR_LIFE_SECONDS),
  );
  target.lifeVariationSeconds = roundTimelineSeconds(
    clamp(current.lifeVariationSeconds * scale, 0, MAX_STAR_LIFE_SECONDS),
  );
}

function setHeadPhaseDurations(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  burnSeconds: number,
  fadeSeconds: number,
): void {
  const timing = estimateFireworkDesignTiming(design);
  const currentHeadDuration = Math.max(
    MIN_STAR_LIFE_SECONDS,
    timing.fadeFinishSeconds - timing.effectStartSeconds,
  );
  const targetHeadDuration = clamp(
    Math.max(0, burnSeconds) + Math.max(0, fadeSeconds),
    MIN_STAR_LIFE_SECONDS,
    MAX_TIMELINE_PHASE_SECONDS,
  );
  const lifeScale = targetHeadDuration / currentHeadDuration;
  const fadePercent = clamp((Math.max(0, fadeSeconds) / targetHeadDuration) * 100, 0, 100);

  let outerLife: [number, number] | null = null;
  for (const layerKey of activeLayerKeys(design)) {
    const nextLife = setLayerLifeAndFade(defaults, design, layerKey, lifeScale, fadePercent);
    if (layerKey === 'outer') outerLife = nextLife;
  }

  if (outerLife) {
    const burst = ensureRecord(defaults, 'burst');
    burst.life = outerLife;
  }
  setAbsoluteGeometryLifeScale(defaults, design, lifeScale);
}

function solveLiftVelocity(design: FireworkDesign, targetSeconds: number): number {
  const shellLife = clamp(Math.max(design.shellLife, targetSeconds + 0.5), 2, 60);
  const candidateDesign = { ...design, shellLife };
  const minimumDuration = estimateFireworkLiftTimeSeconds({
    ...candidateDesign,
    liftVelocity: MIN_LIFT_VELOCITY,
  });
  const maximumDuration = estimateFireworkLiftTimeSeconds({
    ...candidateDesign,
    liftVelocity: MAX_LIFT_VELOCITY,
  });
  const target = clamp(targetSeconds, minimumDuration, maximumDuration);
  let low = MIN_LIFT_VELOCITY;
  let high = MAX_LIFT_VELOCITY;

  for (let iteration = 0; iteration < 28; iteration += 1) {
    const midpoint = (low + high) / 2;
    const duration = estimateFireworkLiftTimeSeconds({
      ...candidateDesign,
      liftVelocity: midpoint,
    });
    if (duration < target) low = midpoint;
    else high = midpoint;
  }

  return roundTimelineSeconds((low + high) / 2);
}

function setAscentDuration(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  seconds: number,
): void {
  if (isGroundFireworkEffect(design)) return;
  const target = clamp(seconds, 0, MAX_TIMELINE_PHASE_SECONDS);
  defaults.shellLife = roundTimelineSeconds(clamp(Math.max(design.shellLife, target + 0.5), 2, 60));
  defaults.liftVelocity = solveLiftVelocity(design, target);
}

function setSplitTailDuration(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  desiredEndAfterBurst: number,
  maximumHeadLife: number,
): void {
  if (!design.split.enabled) return;
  const splitLife = Math.max(0.1, desiredEndAfterBurst - maximumHeadLife * design.split.delayRatio);
  const currentTotal = design.split.lifeBaseSeconds + design.split.lifeVariationSeconds;
  const baseShare = currentTotal > 0 ? design.split.lifeBaseSeconds / currentTotal : 0.5;
  const base = clamp(splitLife * baseShare, 0.1, 6);
  const variation = clamp(splitLife - base, 0, 6);
  const split = ensureRecord(defaults, 'split');
  split.lifeBaseSeconds = roundTimelineSeconds(base);
  split.lifeVariationSeconds = roundTimelineSeconds(variation);
}

function setLaunchTailDuration(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  desiredAbsoluteEnd: number,
): void {
  if (isGroundFireworkEffect(design)) return;

  const liftParticles = design.launch?.liftParticles;
  if (liftParticles?.enabled && liftParticles.amount > 0) {
    const liftTime = estimateFireworkLiftTimeSeconds(design);
    const emissionEnd = liftTime * clamp(liftParticles.height / 100, 0, 1);
    if (usesLegacyLaunchLiftAppearance(design)) {
      const trail = ensureRecord(defaults, 'trail');
      trail.streakLife = roundTimelineSeconds(
        clamp((desiredAbsoluteEnd - emissionEnd) / 0.38, 0.2, 4),
      );
    } else {
      const variation = 1 + clamp(liftParticles.lifetime.variationPercent / 100, 0, 1);
      const trailScale = Math.max(0.2, design.trail.length);
      const targetLife = Math.max(
        0.1,
        (desiredAbsoluteEnd - emissionEnd) / (variation * trailScale),
      );
      const currentLife =
        liftParticles.lifetime.baseSeconds + liftParticles.lifetime.afterglowSeconds;
      const baseShare = currentLife > 0 ? liftParticles.lifetime.baseSeconds / currentLife : 0.8;
      const launch = ensureRecord(defaults, 'launch');
      const particles = ensureRecord(launch, 'liftParticles');
      const lifetime = ensureRecord(particles, 'lifetime');
      const base = clamp(targetLife * baseShare, 0.1, 8);
      lifetime.baseSeconds = roundTimelineSeconds(base);
      lifetime.afterglowSeconds = roundTimelineSeconds(clamp(targetLife - base, 0, 6));
    }
  }

  const smoke = design.launch?.smoke;
  if (!usesLegacyLaunchLiftAppearance(design) && smoke?.enabled && smoke.particles > 0) {
    const liftTime = estimateFireworkLiftTimeSeconds(design);
    const launch = ensureRecord(defaults, 'launch');
    const smokeDefaults = ensureRecord(launch, 'smoke');
    smokeDefaults.lifeSeconds = roundTimelineSeconds(
      clamp((desiredAbsoluteEnd - liftTime) / 1.2, 0.2, 12),
    );
  }
}

function setTailDuration(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  seconds: number,
): void {
  const timing = estimateFireworkDesignTiming(design);
  const targetTail = clamp(seconds, 0, MAX_TIMELINE_PHASE_SECONDS);
  const headDuration = Math.max(0, timing.fadeFinishSeconds - timing.effectStartSeconds);
  const desiredEndAfterBurst = headDuration + targetTail;
  const layerKeys = activeLayerKeys(design);
  const bounds = layerKeys.map((key) => estimateFireworkLayerLifeBounds(design, design.stars[key]));
  const maximumHeadLife = Math.max(...bounds.map((item) => item.max), MIN_STAR_LIFE_SECONDS);
  const trailScale = estimateFireworkTrailLifeScale(design);
  let hasBurstTail = false;

  layerKeys.forEach((layerKey, index) => {
    const trail = design.stars[layerKey].burstTrail;
    if (!trail.enabled || trail.particlesPerStar <= 0) return;
    hasBurstTail = true;
    const randomBoost = 1 + clamp(trail.lifetime.variationPercent / 100, 0, 1);
    const denominator = Math.max(
      MIN_STAR_LIFE_SECONDS,
      bounds[index].max * randomBoost * trailScale,
    );
    const multiplier = clamp(desiredEndAfterBurst / denominator, 0, 2);
    const stars = ensureRecord(defaults, 'stars');
    const layer = ensureRecord(stars, layerKey);
    const burstTrail = ensureRecord(layer, 'burstTrail');
    burstTrail.preset = 'custom';
    const lifetime = ensureRecord(burstTrail, 'lifetime');
    lifetime.percent = roundTimelineSeconds(multiplier);
    if (layerKey === 'outer') {
      const topLevelTrail = ensureRecord(defaults, 'burstTrail');
      topLevelTrail.preset = 'custom';
      const topLevelLifetime = ensureRecord(topLevelTrail, 'lifetime');
      topLevelLifetime.percent = roundTimelineSeconds(multiplier);
    }
  });

  setSplitTailDuration(defaults, design, desiredEndAfterBurst, maximumHeadLife);
  if (!hasBurstTail && !design.split.enabled) {
    setLaunchTailDuration(defaults, design, timing.fadeFinishSeconds + targetTail);
  }
}

function scaleEnabledLaunchDurations(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  scale: number,
): void {
  if (isGroundFireworkEffect(design)) return;

  const liftParticles = design.launch?.liftParticles;
  if (liftParticles?.enabled && liftParticles.amount > 0) {
    if (usesLegacyLaunchLiftAppearance(design)) {
      const currentStreakLife = Number.isFinite(design.trail?.streakLife)
        ? design.trail.streakLife
        : 1;
      const trail = ensureRecord(defaults, 'trail');
      trail.streakLife = roundTimelineSeconds(clamp(currentStreakLife * scale, 0.2, 4));
    } else {
      const launch = ensureRecord(defaults, 'launch');
      const particles = ensureRecord(launch, 'liftParticles');
      const lifetime = ensureRecord(particles, 'lifetime');
      lifetime.baseSeconds = roundTimelineSeconds(
        clamp(liftParticles.lifetime.baseSeconds * scale, 0.1, 8),
      );
      lifetime.afterglowSeconds = roundTimelineSeconds(
        clamp(liftParticles.lifetime.afterglowSeconds * scale, 0, 6),
      );
    }
  }
  const smoke = design.launch?.smoke;
  if (!usesLegacyLaunchLiftAppearance(design) && smoke?.enabled && smoke.particles > 0) {
    const launch = ensureRecord(defaults, 'launch');
    const smokeDefaults = ensureRecord(launch, 'smoke');
    smokeDefaults.lifeSeconds = roundTimelineSeconds(clamp(smoke.lifeSeconds * scale, 0.2, 12));
  }
}

function scaleGroundEmitterDuration(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  scale: number,
): void {
  if (design.geometry !== 'roman_candle' && design.geometry !== 'fountain') return;
  defaults.shellLife = roundTimelineSeconds(clamp(design.shellLife * scale, 2, 60));
  const geometryTuning = ensureRecord(defaults, 'geometryTuning');
  const tuningKey = design.geometry === 'roman_candle' ? 'romanCandle' : 'fountain';
  const target = ensureRecord(geometryTuning, tuningKey);
  const current = design.geometryTuning[tuningKey];
  const minimum = clamp(current.durationMinSeconds * scale, 0.5, 30);
  const maximum = clamp(current.durationMaxSeconds * scale, Math.max(1, minimum), 30);
  target.durationMinSeconds = roundTimelineSeconds(minimum);
  target.durationMaxSeconds = roundTimelineSeconds(maximum);
}

function scaleTotalDuration(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  seconds: number,
): void {
  const timeline = deriveFireworkEditorTimeline(design);
  const target = clamp(seconds, MIN_TIMELINE_TOTAL_SECONDS, MAX_TIMELINE_TOTAL_SECONDS);
  if (timeline.totalDurationSeconds <= 0) return;
  const scale = target / timeline.totalDurationSeconds;
  if (Math.abs(scale - 1) < 0.001) return;

  setAscentDuration(defaults, design, timeline.phases.ascent * scale);
  setHeadPhaseDurations(
    defaults,
    design,
    timeline.phases.burn * scale,
    timeline.phases.fade * scale,
  );
  scaleEnabledLaunchDurations(defaults, design, scale);
  scaleGroundEmitterDuration(defaults, design, scale);
  setTailDuration(defaults, design, timeline.phases.tail * scale);
}

export function deriveFireworkEditorTimeline(design: FireworkDesign): FireworkEditorTimeline {
  const timing = estimateFireworkDesignTiming(design);
  const phases = {
    ascent: roundTimelineSeconds(timing.effectStartSeconds),
    burn: roundTimelineSeconds(Math.max(0, timing.fadeStartSeconds - timing.effectStartSeconds)),
    fade: roundTimelineSeconds(Math.max(0, timing.fadeFinishSeconds - timing.fadeStartSeconds)),
    tail: roundTimelineSeconds(Math.max(0, timing.endSeconds - timing.fadeFinishSeconds)),
  };
  const hasBurstTail = activeLayerKeys(design).some((key) => {
    const trail = design.stars[key].burstTrail;
    return trail.enabled && trail.particlesPerStar > 0;
  });
  const liftParticles = design.launch?.liftParticles;
  const smoke = design.launch?.smoke;
  const launchTailVisible = !isGroundFireworkEffect(design);
  const hasLaunchTail =
    launchTailVisible &&
    (Boolean(liftParticles?.enabled && liftParticles.amount > 0) ||
      Boolean(!usesLegacyLaunchLiftAppearance(design) && smoke?.enabled && smoke.particles > 0));

  return {
    totalDurationSeconds: roundTimelineSeconds(timing.endSeconds),
    phases,
    ascentEditable: !isGroundFireworkEffect(design),
    tailEditable: hasBurstTail || design.split.enabled || hasLaunchTail,
    crackleTailFloorSeconds: design.crackle.enabled && design.crackle.probability > 0 ? 1.3 : 0,
  };
}

export function applyFireworkTimelineEdit(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  key: FireworkTimelineEditKey,
  seconds: number,
): void {
  if (!Number.isFinite(seconds)) return;
  const timeline = deriveFireworkEditorTimeline(design);

  switch (key) {
    case 'total':
      scaleTotalDuration(defaults, design, seconds);
      return;
    case 'ascent':
      setAscentDuration(defaults, design, seconds);
      return;
    case 'burn':
      setHeadPhaseDurations(
        defaults,
        design,
        clamp(seconds, 0, MAX_TIMELINE_HEAD_SECONDS),
        Math.min(
          timeline.phases.fade,
          Math.max(0, MAX_TIMELINE_HEAD_SECONDS - Math.max(0, seconds)),
        ),
      );
      return;
    case 'fade':
      setHeadPhaseDurations(
        defaults,
        design,
        Math.min(
          timeline.phases.burn,
          Math.max(0, MAX_TIMELINE_HEAD_SECONDS - Math.max(0, seconds)),
        ),
        clamp(seconds, 0, MAX_TIMELINE_HEAD_SECONDS),
      );
      return;
    case 'tail':
      setTailDuration(defaults, design, seconds);
  }
}

export function applyFireworkTimelineBoundaryEdit(
  defaults: FireworkTimelineDefaults,
  design: FireworkDesign,
  boundary: FireworkTimelineBoundaryKey,
  seconds: number,
): void {
  if (!Number.isFinite(seconds)) return;
  const timeline = deriveFireworkEditorTimeline(design);
  const { ascent, burn, fade } = timeline.phases;

  switch (boundary) {
    case 'ascent': {
      if (!timeline.ascentEditable) return;
      const nextAscent = clamp(seconds, 0, ascent + burn);
      setAscentDuration(defaults, design, nextAscent);
      setHeadPhaseDurations(defaults, design, ascent + burn - nextAscent, fade);
      return;
    }
    case 'burn': {
      const headEnd = ascent + burn + fade;
      const nextBurn = clamp(seconds - ascent, 0, burn + fade);
      setHeadPhaseDurations(defaults, design, nextBurn, headEnd - ascent - nextBurn);
      return;
    }
    case 'fade': {
      if (!timeline.tailEditable) return;
      const nextFade = clamp(seconds - ascent - burn, 0, fade + timeline.phases.tail);
      setHeadPhaseDurations(defaults, design, burn, nextFade);
      setTailDuration(defaults, design, timeline.totalDurationSeconds - seconds);
    }
  }
}
