/** Per-star burn, colour transition and brightness modifier evaluation. */
import type { Fade, Layer, Modifier } from '../schema/index';
import type { StarDirection } from './directions';
import { hash } from './random';
import { colourAt, mix, PRIME, rgb, smoothstep, WHITE } from './colour';
/** Hash stream selecting a twinkle's independent on/off sample. */
const TWINKLE_STATE_STREAM_OFFSET = 3;
// seconds from star ignition, prototype fade-in.
const IGNITION_RISE_S = 0.07;
// normalised life fraction, prototype final fade start.
const END_FADE_START = 0.92;
// normalised life fraction, prototype final fade window.
const END_FADE_WINDOW = 0.08;
// normalised life fraction, prototype ghost transition softness.
const GHOST_EDGE_WIDTH = 0.05;
// dimensionless prototype visual tuning.
const EMBER_MIX = 0.45;
// dimensionless prototype visual tuning.
const PRIME_RISE_FRACTION = 0.4;
// dimensionless prototype visual tuning.
const PRIME_INITIAL_SIZE = 0.25;
// seconds from ignition, prototype prime growth.
const PRIME_GROWTH_S = 0.35;
// dimensionless prototype visual tuning.
const PRIME_GROWTH_POWER = 1.2;
// dimensionless prototype strobe rate minimum.
const STROBE_RATE_MIN = 0.67;
// dimensionless prototype strobe random rate span.
const STROBE_RATE_RANGE = 0.83;
// dimensionless prototype visual tuning.
const STROBE_SHARPNESS = 10;
// Hz, prototype inverse-rate sharpness term.
const STROBE_SHARPNESS_HZ = 30;
// samples per star, prototype temporal integration.
const STROBE_SAMPLES = 4;
// seconds between samples, prototype temporal integration.
const STROBE_SAMPLE_STEP_S = 0.004;
// normalised life fraction, prototype strobe onset.
const STROBE_ONSET_WINDOW = 0.06;
// dimensionless prototype visual tuning.
const STROBE_ALPHA_GAIN = 2.6;
// dimensionless prototype visual tuning.
const STROBE_WHITE_GAIN = 0.7;
// dimensionless prototype visual tuning.
const STROBE_FLARE_GAIN = 0.6;
// dimensionless prototype visual tuning.
const TWINKLE_ALPHA_RANGE = 1.1;
// dimensionless prototype visual tuning.
const FLUTTER_ALPHA_MIN = 0.3;
// rad/s, prototype flutter brightness frequency.
const FLUTTER_RATE_RAD_S = 5;
// dimensionless prototype visual tuning.
const FLUTTER_ALPHA_POWER = 3;
// Prototype twinkle baseline opacity, dimensionless.
const TWINKLE_ALPHA_MIN = 0.25;
// Prototype flutter opacity span, dimensionless.
const FLUTTER_ALPHA_RANGE = 0.7;
/** Computes the burn alpha for an age and lifetime in seconds. */
export function fadeAlpha(fade: Fade, age: number, life: number): number {
  const progress = age / life;
  let alpha = Math.min(1, age / IGNITION_RISE_S);
  if (progress > fade.fade_at)
    alpha *= Math.max(0, 1 - (progress - fade.fade_at) / (1 - fade.fade_at));
  if (progress > END_FADE_START) alpha *= Math.max(0, (1 - progress) / END_FADE_WINDOW);
  return alpha;
}
/** Computes fresh linear RGB, size multiplier, alpha and strobe state without mutating inputs.
 * age and positive life are ignition-relative seconds; validated layer/fade controls
 * and dimensionless starIndex/seed select deterministic appearance. */
// eslint-disable-next-line max-params -- The per-star scalar API avoids a transient options object; ordered brightness steps reuse the returned appearance allocation.
export function starAppearance(
  layer: Layer,
  fade: Fade,
  direction: StarDirection,
  starIndex: number,
  age: number,
  life: number,
  seed = 1,
) {
  const progress = age / life;
  const { colourProgress, dip } = ghostEnvelope(layer, direction, progress);
  const base = colourAt(layer.colour, colourProgress, starIndex, direction.h);
  let colour = burnColour(base, fade, progress, direction.h2);
  let grow = 1;
  if (age < fade.prime_s) {
    colour = mix(PRIME, colour, smoothstep(fade.prime_s * PRIME_RISE_FRACTION, fade.prime_s, age));
    grow = Math.pow(Math.min(1, PRIME_INITIAL_SIZE + age / PRIME_GROWTH_S), PRIME_GROWTH_POWER);
  }
  const reignition = layer.colour.reignition;
  const flare =
    reignition &&
    !layer.modifiers.some((modifier) => modifier.kind === 'ghost') &&
    progress > reignition.at
      ? 1 + reignition.amount * Math.max(0, 1 - (progress - reignition.at) / reignition.duration)
      : 1;
  const appearance = {
    base,
    colour,
    grow,
    flare,
    alpha: fadeAlpha(fade, age, life) * dip,
    strobing: false,
  };
  for (const modifier of layer.modifiers)
    applyBrightnessModifier(appearance, modifier, direction, starIndex, age, progress, seed);
  return appearance;
}
// Synchronous scratch avoids a second modifier scan or an extra object per star.
// Callers copy both scalar results before sampling colour or evaluating brightness.
const ghostScratch = { colourProgress: 0, dip: 1 };
function ghostEnvelope(layer: Layer, direction: StarDirection, progress: number) {
  ghostScratch.colourProgress = progress;
  ghostScratch.dip = 1;
  for (const modifier of layer.modifiers)
    if (modifier.kind === 'ghost') {
      const change =
        layer.colour.reignition?.at ??
        layer.colour.stops.find(
          (stop, index, stops) => index > 0 && stop[0] === stops[index - 1]?.[0],
        )?.[0];
      if (change === undefined) continue;
      // Shift the colour transition across the burst, with a dark gap at its edge.
      const transitionProgress =
        change + (direction.x + 1) * 0.5 * modifier.amount + modifier.gap / 2;
      ghostScratch.colourProgress -= transitionProgress - change;
      ghostScratch.dip *= smoothstep(
        modifier.gap / 2,
        modifier.gap / 2 + GHOST_EDGE_WIDTH,
        Math.abs(progress - transitionProgress),
      );
    }
  return ghostScratch;
}
function burnColour(
  base: ReturnType<typeof colourAt>,
  fade: Fade,
  progress: number,
  secondaryRandom: number,
) {
  const whiteHotUntil = fade.white_hot * (0.5 + secondaryRandom);
  if (progress < whiteHotUntil) return mix(WHITE, base, progress / whiteHotUntil);
  if (progress > fade.ember_at)
    return mix(
      base,
      rgb('#ff7a33'),
      EMBER_MIX * Math.min(1, (progress - fade.ember_at) / (1 - fade.ember_at)),
    );
  return base;
}
type Appearance = {
  base: ReturnType<typeof colourAt>;
  colour: ReturnType<typeof colourAt>;
  grow: number;
  flare: number;
  alpha: number;
  strobing: boolean;
};
// eslint-disable-next-line max-params -- Scalar star controls keep ordered brightness evaluation free of extra per-star context allocation.
function applyBrightnessModifier(
  appearance: Appearance,
  modifier: Modifier,
  direction: StarDirection,
  starIndex: number,
  age: number,
  progress: number,
  seed: number,
): void {
  if (modifier.kind === 'strobe' && progress > modifier.at) {
    const rateHz = modifier.rate_hz * (STROBE_RATE_MIN + STROBE_RATE_RANGE * direction.h2);
    const sharpness = STROBE_SHARPNESS + STROBE_SHARPNESS_HZ / rateHz;
    let pulse = 0;
    for (let sampleIndex = 0; sampleIndex < STROBE_SAMPLES; sampleIndex++) {
      const pulsePhase = (age - sampleIndex * STROBE_SAMPLE_STEP_S) * rateHz + direction.ph;
      pulse += Math.pow(1 - (pulsePhase - Math.floor(pulsePhase)), sharpness);
    }
    pulse /= STROBE_SAMPLES;
    const onset = smoothstep(modifier.at, modifier.at + STROBE_ONSET_WINDOW, progress);
    appearance.strobing ||= onset > 0.5;
    appearance.alpha *= 1 - onset + onset * Math.min(2, STROBE_ALPHA_GAIN * pulse);
    appearance.colour = mix(appearance.colour, WHITE, STROBE_WHITE_GAIN * pulse * onset);
    appearance.flare *= 1 + STROBE_FLARE_GAIN * pulse * onset;
  } else if (modifier.kind === 'twinkle' && progress > modifier.at) {
    const twinkleSample = hash(
      starIndex,
      Math.floor(age * modifier.rate_hz),
      seed + TWINKLE_STATE_STREAM_OFFSET,
    );
    appearance.alpha *= TWINKLE_ALPHA_MIN + TWINKLE_ALPHA_RANGE * twinkleSample * twinkleSample;
  } else if (modifier.kind === 'flutter') {
    appearance.alpha *=
      FLUTTER_ALPHA_MIN +
      FLUTTER_ALPHA_RANGE *
        Math.pow(Math.abs(Math.sin(age * FLUTTER_RATE_RAD_S + direction.ph)), FLUTTER_ALPHA_POWER);
  }
}
