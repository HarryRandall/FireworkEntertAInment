/** Burst-core flash and ring particles evaluated alongside shell stars. */
import type { Core, Layer } from '../schema/index';
import { mix, rgb, WHITE, type Vec3 } from './colour';
import { directions, unit } from './directions';
import { type ParticleWriter } from './particles';
import { hash } from './random';

// Prototype core-flash random streams select independent spark lifetime and reach.
const CORE_SPARK_LIFETIME_STREAM = 91;
const CORE_SPARK_REACH_STREAM = 92;
// Prototype visual tuning for the flash and ring particle envelopes.
const FLASH_DURATION_S = 0.15;
const FLASH_RISE_S = 0.02;
const FLASH_DECAY_S = 0.035;
const FLASH_SIZE_RADIUS_SCALE = 0.6;
const FLASH_SIZE_MAX_PX = 14;
const FLASH_INTENSITY_MAX = 1.5;
const FLASH_ENVELOPE_ALPHA = 0.2;
const FLASH_SIZE_RISE_S = 0.04;
const FLASH_SIZE_MIN = 0.6;
// Prototype main flash growth, dimensionless size multiplier; distinct from the early glow.
const FLASH_SIZE_RANGE = 0.4;
const FLASH_INTENSITY_ALPHA_MAX = 2.2;
const FLASH_EARLY_GLOW_S = 0.08;
const FLASH_GLOW_EASE_EXPONENT = 0.65;
const FLASH_GLOW_RADIUS_SCALE = 0.1;
const FLASH_GLOW_SIZE_MIN = 0.4;
const FLASH_GLOW_SIZE_RANGE = 0.6;
const FLASH_GLOW_ALPHA = 0.9;
const CORE_SPARK_DURATION_S = 0.8;
const CORE_SPARK_COUNT = 260;
const CORE_SPARK_COUNT_INTENSITY_MAX = 1.6;
const CORE_SPARK_LIFE_MIN_S = 0.25;
const CORE_SPARK_LIFE_RANGE_S = 0.2;
const CORE_SPARK_INDEX_SCALE = 3;
const CORE_SPARK_SEED_SCALE = 5;
const CORE_SPARK_SEED_OFFSET = 17;
const CORE_SPARK_REACH_MIN = 0.15;
const CORE_SPARK_REACH_RANGE = 0.3;
const CORE_SPARK_DRAG_PER_S = 7;
const CORE_SPARK_GRAVITY_M_S2 = 0.6;
const CORE_SPARK_COLOUR_TRANSITION = 3;
const CORE_SPARK_SIZE_PX = 0.28;
const CORE_SPARK_ALPHA = 1.1;
const CORE_SPARK_FADE_EXPONENT = 1.5;
const CORE_LIFE_S = 0.45;
const CORE_DIRECTION_SEED_OFFSET = 7;
const CORE_RADIUS_SCALE = 0.6;
const CORE_DRAG_PER_S = 5;
const CORE_COLOUR_TRANSITION = 3;
const CORE_SPARK_RING_SIZE_PX = 0.35;
const CORE_RING_ALPHA = 1.3;

/** Appends one break's core particles for an age in seconds at a centre in metres. */
// eslint-disable-next-line max-params -- The scalar break API is called once per layer; preserve its tested call shape while the internal steps share one workspace.
export function fillCore(
  writer: ParticleWriter,
  core: Core,
  layer: Layer,
  seed: number,
  layerIndex: number,
  age: number,
  centre: Vec3,
): void {
  if (!core.enabled || !layer.flash) return;
  const context = { layer, seed, layerIndex, centre };
  fillFlash(writer, core, age, context);
  fillFlashSparks(writer, core, age, context);
  fillCoreRing(writer, core, age, context);
}
interface CoreContext {
  layer: Layer;
  seed: number;
  layerIndex: number;
  centre: Vec3;
}
function fillFlash(writer: ParticleWriter, core: Core, age: number, context: CoreContext): void {
  const { layer, centre } = context;
  const radiusM = layer.radius_m;
  if (core.flash_on && age < FLASH_DURATION_S) {
    const env =
      age < FLASH_RISE_S ? age / FLASH_RISE_S : Math.exp(-(age - FLASH_RISE_S) / FLASH_DECAY_S);
    writer.glow(
      centre,
      rgb('#ffe2b8'),
      Math.min(radiusM * FLASH_SIZE_RADIUS_SCALE, FLASH_SIZE_MAX_PX) *
        Math.min(FLASH_INTENSITY_MAX, core.flash) *
        (FLASH_SIZE_MIN + FLASH_SIZE_RANGE * Math.min(1, age / FLASH_SIZE_RISE_S)),
      FLASH_ENVELOPE_ALPHA * env * Math.min(FLASH_INTENSITY_ALPHA_MAX, core.flash),
    );
    if (age < FLASH_EARLY_GLOW_S) {
      const glowEnvelope = Math.sin(
        Math.pow(age / FLASH_EARLY_GLOW_S, FLASH_GLOW_EASE_EXPONENT) * Math.PI,
      );
      writer.glow(
        centre,
        WHITE,
        radiusM *
          FLASH_GLOW_RADIUS_SCALE *
          core.flash *
          (FLASH_GLOW_SIZE_MIN + FLASH_GLOW_SIZE_RANGE * glowEnvelope),
        FLASH_GLOW_ALPHA * glowEnvelope,
      );
    }
  }
}
function fillFlashSparks(
  writer: ParticleWriter,
  core: Core,
  age: number,
  context: CoreContext,
): void {
  const { layer, seed, layerIndex, centre } = context;
  const radiusM = layer.radius_m;
  if (core.flash_on && age < CORE_SPARK_DURATION_S) {
    const sparkCount = Math.round(
      CORE_SPARK_COUNT * Math.min(CORE_SPARK_COUNT_INTENSITY_MAX, core.flash),
    );
    const gold = rgb('#ffe2a8');
    for (let sparkIndex = 0; sparkIndex < sparkCount; sparkIndex++) {
      const life =
        CORE_SPARK_LIFE_MIN_S +
        CORE_SPARK_LIFE_RANGE_S * hash(sparkIndex, seed + layerIndex, CORE_SPARK_LIFETIME_STREAM);
      if (age > life) continue;
      const direction = unit(
        sparkIndex * CORE_SPARK_INDEX_SCALE + layerIndex,
        seed * CORE_SPARK_SEED_SCALE + CORE_SPARK_SEED_OFFSET,
      );
      const reach =
        radiusM *
        (CORE_SPARK_REACH_MIN +
          CORE_SPARK_REACH_RANGE * hash(sparkIndex, seed + layerIndex, CORE_SPARK_REACH_STREAM));
      const expansion = reach * (1 - Math.exp(-CORE_SPARK_DRAG_PER_S * age));
      const progress = age / life;
      writer.spark(
        [
          centre[0] + direction[0] * expansion,
          centre[1] + direction[1] * expansion - CORE_SPARK_GRAVITY_M_S2 * age * age,
          centre[2] + direction[2] * expansion,
        ],
        mix(WHITE, gold, Math.min(1, progress * CORE_SPARK_COLOUR_TRANSITION)),
        CORE_SPARK_SIZE_PX,
        CORE_SPARK_ALPHA * Math.pow(1 - progress, CORE_SPARK_FADE_EXPONENT),
      );
    }
  }
}
function fillCoreRing(writer: ParticleWriter, core: Core, age: number, context: CoreContext): void {
  const { layer, seed, layerIndex, centre } = context;
  const radiusM = layer.radius_m;
  if (core.ring && age < CORE_LIFE_S) {
    const starDirections = directions(
      core.count,
      'sphere',
      seed + CORE_DIRECTION_SEED_OFFSET + layerIndex,
    );
    const coreRadiusM = radiusM * core.radius * CORE_RADIUS_SCALE;
    const expansion = 1 - Math.exp(-CORE_DRAG_PER_S * age);
    const progress = age / CORE_LIFE_S;
    const alpha = Math.pow(1 - progress, 2);
    const colour = mix(WHITE, rgb(core.colour), Math.min(1, progress * CORE_COLOUR_TRANSITION));
    for (const direction of starDirections) {
      const distanceM = coreRadiusM * Math.sqrt(direction.h) * expansion;
      writer.spark(
        [
          centre[0] + direction.x * distanceM,
          centre[1] + direction.y * distanceM,
          centre[2] + direction.z * distanceM,
        ],
        colour,
        CORE_SPARK_RING_SIZE_PX,
        alpha * CORE_RING_ALPHA,
      );
    }
  }
}
