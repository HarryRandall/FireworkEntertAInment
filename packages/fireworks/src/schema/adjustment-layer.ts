/** Resolves layer quick controls within the stored schema limits. */
import type { Layer } from './design.generated';
import { clampControl as clamp, roundedControl as rounded } from './adjustment-bounds';

// Prototype ADJ brightness multiplier per level, dimensionless.
const BRIGHTNESS_FACTOR = 1.2;
// Validated v1 min duration bound, seconds.
const MIN_DURATION_S = 0.001;
// Validated v1 max duration bound, seconds.
const MAX_DURATION_S = 120;
// Prototype ADJ max star count bound, particles.
const MAX_STAR_COUNT = 10000;
// Prototype ADJ min layer stars bound, particles.
const MIN_LAYER_STARS = 3;
// Validated v1 gravity bound, metres per second squared.
const MIN_GRAVITY_M_S2 = -40;
// Validated v1 gravity bound, metres per second squared.
const MAX_GRAVITY_M_S2 = 100;
// Prototype ADJ spread step, dimensionless increment per level.
const SPREAD_STEP = 0.12;
// Prototype ADJ max speed var control bound, dimensionless authored units.
const MAX_SPEED_VAR = 0.9;
// Validated v1 max trail duration bound, seconds.
const MAX_TRAIL_DURATION_S = 20;
// Validated v1 ejection speed upper bound, metres per second.
const MAX_SPREAD_M_S = 200;
// Prototype ADJ glitter step, dimensionless increment per level.
const GLITTER_STEP = 0.35;
// Prototype ADJ min modifier amount control bound, dimensionless authored units.
const MIN_MODIFIER_AMOUNT = -20;
// Prototype ADJ max modifier count bound, particles.
const MAX_MODIFIER_COUNT = 400;
// Validated v1 angular-speed lower bound, radians per second.
const MIN_ANGULAR_SPEED_RAD_S = -500;
// Prototype ADJ modifier timing step, dimensionless increment per level.
const MODIFIER_TIMING_STEP = 0.08;
// Prototype ADJ min modifier at bound, normalised life fraction.
const MIN_MODIFIER_AT = 0.05;
// Prototype ADJ max modifier at bound, normalised life fraction.
const MAX_MODIFIER_AT = 0.95;
// Prototype ADJ layer radius multiplier per level, dimensionless.
const LAYER_RADIUS_FACTOR = 1.15;
// Validated v1 max layer radius bound, metres.
const MAX_LAYER_RADIUS_M = 500;
// Prototype ADJ star count multiplier per level, dimensionless.
const STAR_COUNT_FACTOR = 1.3;
// Prototype ADJ max brightness control bound, dimensionless authored units.
const MAX_BRIGHTNESS = 10;
// Prototype ADJ burn life multiplier per level, dimensionless.
const BURN_LIFE_FACTOR = 1.25;
// Prototype ADJ gravity multiplier per level, dimensionless.
const GRAVITY_FACTOR = 1.35;
// Prototype ADJ head size multiplier per level, dimensionless.
const HEAD_SIZE_FACTOR = 1.2;
// Prototype ADJ max head size control bound, dimensionless authored units.
const MAX_HEAD_SIZE = 10;
// Prototype ADJ trail length multiplier per level, dimensionless.
const TRAIL_LENGTH_FACTOR = 1.3;
// Prototype ADJ trail count multiplier per level, dimensionless.
const TRAIL_COUNT_FACTOR = 1.35;
// Prototype ADJ glitter flicker control bound, dimensionless authored units.
const GLITTER_FLICKER = 0.9;
// Prototype ADJ trail speed multiplier per level, dimensionless.
const TRAIL_SPEED_FACTOR = 1.3;
// Prototype ADJ modifier amount multiplier per level, dimensionless.
const MODIFIER_AMOUNT_FACTOR = 1.3;
// Prototype ADJ max modifier amount control bound, dimensionless authored units.
const MAX_MODIFIER_AMOUNT = 20;
// Prototype ADJ modifier count multiplier per level, dimensionless.
const MODIFIER_COUNT_FACTOR = 1.25;
// Prototype ADJ modifier rate multiplier per level, dimensionless.
const MODIFIER_RATE_FACTOR = 1.15;
// Validated v1 modifier frequency bound, Hz.
const MIN_MODIFIER_RATE_HZ = 0.001;
// Validated v1 modifier frequency bound, Hz.
const MAX_MODIFIER_RATE_HZ = 500;
// Prototype ADJ modifier spin multiplier per level, dimensionless.
const MODIFIER_SPIN_FACTOR = 1.3;
// Validated v1 angular-speed upper bound, radians per second.
const MAX_ANGULAR_SPEED_RAD_S = 500;

/** Mutates validated design controls by a dimensionless level; retains stored field units and schema bounds. */
export function adjustLayer(layer: Layer, field: string, level: number): void {
  if (field === 'size')
    layer.radius_m = clamp(layer.radius_m * LAYER_RADIUS_FACTOR ** level, 0, MAX_LAYER_RADIUS_M);
  else if (field === 'stars')
    layer.count = rounded(
      layer.count * STAR_COUNT_FACTOR ** level,
      MIN_LAYER_STARS,
      MAX_STAR_COUNT,
    );
  else if (field === 'brightness')
    layer.brightness = layer.brightness.map(([at, value]) => [
      at,
      clamp(value * BRIGHTNESS_FACTOR ** level, 0, MAX_BRIGHTNESS),
    ]);
  else if (field === 'burn')
    layer.life_s = clamp(layer.life_s * BURN_LIFE_FACTOR ** level, MIN_DURATION_S, MAX_DURATION_S);
  else if (field === 'droop')
    layer.gravity_m_s2 = clamp(
      layer.gravity_m_s2 * GRAVITY_FACTOR ** level,
      MIN_GRAVITY_M_S2,
      MAX_GRAVITY_M_S2,
    );
  else if (field === 'spread')
    layer.speed_var = clamp(layer.speed_var + SPREAD_STEP * level, 0, MAX_SPEED_VAR);
  else if (field === 'star_size')
    layer.head.size = clamp(layer.head.size * HEAD_SIZE_FACTOR ** level, 0, MAX_HEAD_SIZE);
  else adjustTrail(layer, field, level);
}

function adjustTrail(layer: Layer, field: string, level: number): void {
  if (field === 'trail.length')
    layer.trail.length_s = clamp(
      layer.trail.length_s * TRAIL_LENGTH_FACTOR ** level,
      MIN_DURATION_S,
      MAX_TRAIL_DURATION_S,
    );
  else if (field === 'trail.density')
    layer.trail.sparks = rounded(
      Math.max(layer.trail.sparks, 2) * TRAIL_COUNT_FACTOR ** level,
      0,
      MAX_STAR_COUNT,
    );
  else if (field === 'trail.spray')
    layer.trail.spread_m_s = clamp(
      layer.trail.spread_m_s * TRAIL_SPEED_FACTOR ** level,
      0,
      MAX_SPREAD_M_S,
    );
  else if (field === 'trail.glitter') {
    layer.trail.glitter = clamp(layer.trail.glitter + GLITTER_STEP * level, 0, 1);
    if (level > 0) layer.trail.flicker = GLITTER_FLICKER;
  } else adjustModifiers(layer, field, level);
}

function adjustModifiers(layer: Layer, field: string, level: number): void {
  if (field === 'modifier.amount')
    for (const modifier of layer.modifiers) {
      modifier.amount = clamp(
        modifier.amount * MODIFIER_AMOUNT_FACTOR ** level,
        MIN_MODIFIER_AMOUNT,
        MAX_MODIFIER_AMOUNT,
      );
      modifier.count = rounded(
        modifier.count * MODIFIER_COUNT_FACTOR ** level,
        1,
        MAX_MODIFIER_COUNT,
      );
      modifier.rate_hz = clamp(
        modifier.rate_hz * MODIFIER_RATE_FACTOR ** level,
        MIN_MODIFIER_RATE_HZ,
        MAX_MODIFIER_RATE_HZ,
      );
      modifier.angular_speed_rad_s = clamp(
        modifier.angular_speed_rad_s * MODIFIER_SPIN_FACTOR ** level,
        MIN_ANGULAR_SPEED_RAD_S,
        MAX_ANGULAR_SPEED_RAD_S,
      );
    }
  else if (field === 'modifier.timing')
    for (const modifier of layer.modifiers)
      modifier.at = clamp(
        modifier.at + MODIFIER_TIMING_STEP * level,
        MIN_MODIFIER_AT,
        MAX_MODIFIER_AT,
      );
}
