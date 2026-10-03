/** Independent crackle sparks and crossette child paths on the parent source clock. */
import { prototypeOr } from './numeric';
import type { Trail } from '../schema/index';
import { WHITE, type Vec3 } from './colour';

import { type ParticleWriter } from './particles';

import { spray, TRAIL_DENSITY, TRAIL_LIFE } from './spray';
import { hash } from './random';

// Prototype split-child flash opacity and head halo multiplier, dimensionless.
const CHILD_FLASH_ALPHA = 0.5;
const CHILD_HALO_ALPHA = 0.5;
// Prototype crackle tint, linear RGB channel intensities.
const CRACKLE_GREEN = 0.85;
const CRACKLE_BLUE = 0.55;
const CRACKLE_RGB: Vec3 = [1, CRACKLE_GREEN, CRACKLE_BLUE];
// Prototype deterministic seed partition: crackle key stride (dimensionless key multiplier).
const CRACKLE_KEY_STRIDE = 31;
// Prototype deterministic seed partition: crackle seed scale (dimensionless seed multiplier).
const CRACKLE_SEED_SCALE = 37;
// Prototype visual tuning: crackle flash s (seconds).
const CRACKLE_FLASH_S = 0.025;
// Prototype visual tuning: crackle flash alpha (opacity).
const CRACKLE_FLASH_ALPHA = 0.35;
// Prototype visual tuning: crackle flash size (renderer size).
const CRACKLE_FLASH_SIZE = 0.9;
// Prototype visual tuning: crackle alpha (opacity multiplier).
const CRACKLE_ALPHA = 2.2;
// Prototype visual tuning: crackle size (renderer size).
const CRACKLE_SIZE = 0.65;
// Prototype visual tuning: crackle life s (seconds).
const CRACKLE_LIFE_S = 0.06;
// Prototype visual tuning: crackle fall m s (m/s).
const CRACKLE_FALL_M_S = 1.5;
// Prototype visual tuning: crackle delay power (dimensionless exponent).
const CRACKLE_DELAY_POWER = 1.2;
// Prototype visual tuning: crackle delay range s (seconds).
const CRACKLE_DELAY_RANGE_S = 0.55;
// Prototype visual tuning: crackle delay s (seconds).
const CRACKLE_DELAY_S = 0.05;
// Prototype visual tuning: crossette axis limit (unit direction component, avoids a near-parallel basis).
const CROSSETTE_AXIS_LIMIT = 0.9;
// Prototype visual tuning: child fade start (life fraction).
const CHILD_FADE_START = 0.6;
// Prototype visual tuning: child fade window (life fraction).
const CHILD_FADE_WINDOW = 0.4;
// Prototype visual tuning: child phase rad (radians).
const CHILD_PHASE_RAD = 0.6;
// Prototype visual tuning: child forward bias (velocity direction fraction).
const CHILD_FORWARD_BIAS = 0.25;
// Prototype visual tuning: child drag per s (1/s).
const CHILD_DRAG_PER_S = 3;
// Prototype visual tuning: child trail flicker (opacity variation).
const CHILD_TRAIL_FLICKER = 0.2;
// Prototype visual tuning: child trail drag per s (1/s).
const CHILD_TRAIL_DRAG_PER_S = 2.6;
// Prototype visual tuning: child trail factor (density or life multiplier).
const CHILD_TRAIL_FACTOR = 0.7;
// Prototype visual tuning: child trail min life s (seconds).
const CHILD_TRAIL_MIN_LIFE_S = 0.35;
// Prototype visual tuning: child trail default count (sparks).
const CHILD_TRAIL_DEFAULT_COUNT = 20;
// Prototype visual tuning: child trail min count (sparks).
const CHILD_TRAIL_MIN_COUNT = 24;
// Prototype visual tuning: child flash s (seconds).
const CHILD_FLASH_S = 0.05;
// Prototype visual tuning: child flash size (renderer size).
const CHILD_FLASH_SIZE = 2.5;
// Prototype visual tuning: child trail default life s (seconds).
const CHILD_TRAIL_DEFAULT_LIFE_S = 0.5;
// Prototype visual tuning: child trail gravity m s2 (m/s²).
const CHILD_TRAIL_GRAVITY_M_S2 = 3;
// Prototype random streams independently sample crackle timing, direction, reach and repetition.
const CRACKLE_TIME_STREAM = 23;
const CRACKLE_AZIMUTH_STREAM = 21;
const CRACKLE_VERTICAL_STREAM = 22;
const CRACKLE_REACH_STREAM = 24;

/** Appends crackle from origin with reach in metres; at/now share a source clock in seconds.
 * count/key/seed are dimensionless validated controls; mutates writer only. */
export function crackle /* eslint-disable-line max-params -- The bounded child-spark kernel consumes scalar source clocks and geometry without a per-spark options allocation. */(
  writer: ParticleWriter,
  origin: Vec3,
  at: number,
  now: number,
  count: number,
  key: number,
  seed: number,
  reach: number,
): void {
  for (let childIndex = 0; childIndex < count; childIndex++) {
    const birthTimeS =
      at +
      CRACKLE_DELAY_S +
      CRACKLE_DELAY_RANGE_S *
        Math.pow(
          hash(key * CRACKLE_KEY_STRIDE + childIndex, seed, CRACKLE_TIME_STREAM),
          CRACKLE_DELAY_POWER,
        );
    const age = now - birthTimeS;
    if (age < 0 || age > CRACKLE_LIFE_S) continue;
    const angleRad =
      hash(key, childIndex + seed * CRACKLE_SEED_SCALE, CRACKLE_AZIMUTH_STREAM) * Math.PI * 2;
    const verticalUnit =
      hash(key, childIndex + seed * CRACKLE_SEED_SCALE, CRACKLE_VERTICAL_STREAM) * 2 - 1;
    const horizontalUnit = Math.sqrt(1 - verticalUnit * verticalUnit);
    const distanceM =
      reach * Math.sqrt(hash(key, childIndex + seed * CRACKLE_SEED_SCALE, CRACKLE_REACH_STREAM));
    const position: Vec3 = [
      origin[0] + Math.cos(angleRad) * horizontalUnit * distanceM,
      origin[1] + verticalUnit * distanceM - CRACKLE_FALL_M_S * (birthTimeS - at),
      origin[2] + Math.sin(angleRad) * horizontalUnit * distanceM,
    ];
    const fade = 1 - age / CRACKLE_LIFE_S;
    const colour = CRACKLE_RGB;
    writer.spark(position, colour, CRACKLE_SIZE, CRACKLE_ALPHA * fade * fade);
    if (age < CRACKLE_FLASH_S)
      writer.glow(
        position,
        colour,
        CRACKLE_FLASH_SIZE,
        CRACKLE_FLASH_ALPHA * (1 - age / CRACKLE_FLASH_S),
      );
  }
}
/** Source-clock inputs for a split child's independent trail. */
export interface ChildTrail {
  /** Child birth time in seconds on the parent source clock. */
  at: number;
  /** Evaluation time in seconds on the same source clock. */
  now: number;
  /** Authored count, lifetime in seconds, speed in m/s, size and glitter controls. */
  trail: Pick<Trail, 'sparks' | 'length_s' | 'spread_m_s' | 'size' | 'glitter'>;
  /** Linear RGB colour of the child trail. */
  colour: Vec3;
  /** Dimensionless seed partition for the child source. */
  seed: number;
}

/** Appends crossette heads and optional trails from origin in metres.
 * velocity specifies the parent's travel direction in m/s; age and life are
 * seconds, reach is metres, gravity is m/s², colour is linear RGB and size is
 * renderer units. Child sources use the parent's clock through tail.at/now.
 * Requires validated controls with positive life; mutates writer only. */
export function crossette /* eslint-disable-line max-params -- The bounded child kernel shares scalar geometry across head and trail evaluation without a per-child options allocation. */(
  writer: ParticleWriter,
  origin: Vec3,
  velocity: Vec3,
  age: number,
  life: number,
  count: number,
  reach: number,
  gravity: number,
  colour: Vec3,
  size: number,
  tail?: ChildTrail,
): void {
  if (age < 0 || age > life) return;
  initialiseChildBasis(velocity);
  if (age < CHILD_FLASH_S)
    writer.glow(origin, WHITE, CHILD_FLASH_SIZE, CHILD_FLASH_ALPHA * (1 - age / CHILD_FLASH_S));
  const progress = age / life;
  const alpha =
    progress > CHILD_FADE_START ? 1 - (progress - CHILD_FADE_START) / CHILD_FADE_WINDOW : 1;
  for (let childIndex = 0; childIndex < count; childIndex++) {
    const angleRad = (childIndex / count) * Math.PI * 2 + CHILD_PHASE_RAD;
    const angleCosine = Math.cos(angleRad);
    const angleSine = Math.sin(angleRad);
    const childDirectionX =
      childBasis.perpendicularX * angleCosine +
      childBasis.binormalX * angleSine +
      childBasis.forwardX * CHILD_FORWARD_BIAS;
    const childDirectionY =
      childBasis.perpendicularY * angleCosine +
      childBasis.binormalY * angleSine +
      childBasis.forwardY * CHILD_FORWARD_BIAS;
    const childDirectionZ =
      childBasis.perpendicularZ * angleCosine +
      childBasis.binormalZ * angleSine +
      childBasis.forwardZ * CHILD_FORWARD_BIAS;
    if (tail) {
      const path = (time: number): Vec3 => {
        const childAgeS = time - tail.at;
        return childPosition(
          origin,
          childDirectionX,
          childDirectionY,
          childDirectionZ,
          reach,
          gravity,
          childAgeS,
        );
      };
      fillChildTrail(writer, tail, path, alpha, childIndex, life);
    }
    writer.head(
      childPosition(origin, childDirectionX, childDirectionY, childDirectionZ, reach, gravity, age),
      colour,
      size,
      alpha,
      CHILD_HALO_ALPHA,
    );
  }
}
// Analytic child travel in metres on the child-relative clock in seconds.
// Returning the existing position tuple adds no context allocation to the child loop.
function childPosition /* eslint-disable-line max-params -- Scalar direction lanes avoid allocating a vector or context per child; this helper owns the shared head/trail motion formula. */(
  origin: Vec3,
  directionX: number,
  directionY: number,
  directionZ: number,
  reach: number,
  gravity: number,
  age: number,
): Vec3 {
  const dragFraction = 1 - Math.exp(-CHILD_DRAG_PER_S * age);
  return [
    origin[0] + directionX * reach * dragFraction,
    origin[1] +
      directionY * reach * dragFraction -
      (gravity / CHILD_DRAG_PER_S) * (age - dragFraction / CHILD_DRAG_PER_S),
    origin[2] + directionZ * reach * dragFraction,
  ];
}

function fillChildTrail /* eslint-disable-line max-params -- Scalar child lifetime and index avoid extra options allocation in the child loop. */(
  writer: ParticleWriter,
  tail: ChildTrail,
  path: (time: number) => Vec3,
  alpha: number,
  childIndex: number,
  life: number,
): void {
  spray(writer, path, tail.at, tail.at + life, tail.now, {
    count: Math.max(
      CHILD_TRAIL_MIN_COUNT,
      Math.round(
        prototypeOr(tail.trail.sparks, CHILD_TRAIL_DEFAULT_COUNT) *
          TRAIL_DENSITY *
          CHILD_TRAIL_FACTOR,
      ),
    ),
    life: Math.max(
      CHILD_TRAIL_MIN_LIFE_S,
      prototypeOr(tail.trail.length_s, CHILD_TRAIL_DEFAULT_LIFE_S) *
        TRAIL_LIFE *
        CHILD_TRAIL_FACTOR,
    ),
    spread: tail.trail.spread_m_s,
    gravity: CHILD_TRAIL_GRAVITY_M_S2,
    drag: CHILD_TRAIL_DRAG_PER_S,
    size: tail.trail.size,
    flicker: CHILD_TRAIL_FLICKER,
    glitter: tail.trail.glitter,
    colour: tail.colour,
    seed: tail.seed + childIndex,
    alpha,
    inherit: 0,
  });
}

// Reused synchronous cross-product workspace. Child source callbacks capture the scalar
// child direction before emitting trails. The synchronous particle writer does not
// call back into this basis builder, and source sampling uses only captured scalars.
const childBasis = {
  forwardX: 0,
  forwardY: 0,
  forwardZ: 0,
  perpendicularX: 0,
  perpendicularY: 0,
  perpendicularZ: 0,
  binormalX: 0,
  binormalY: 0,
  binormalZ: 0,
};
function initialiseChildBasis(velocity: Vec3): void {
  // Cross the parent's forward vector with a non-parallel axis, then complete an orthogonal basis.
  const length = prototypeOr(Math.hypot(...velocity), 1);
  childBasis.forwardX = velocity[0] / length;
  childBasis.forwardY = velocity[1] / length;
  childBasis.forwardZ = velocity[2] / length;
  const axisX = Math.abs(childBasis.forwardY) < CROSSETTE_AXIS_LIMIT ? 0 : 1;
  const axisY = Math.abs(childBasis.forwardY) < CROSSETTE_AXIS_LIMIT ? 1 : 0;
  childBasis.perpendicularX = axisY * childBasis.forwardZ;
  childBasis.perpendicularY = -axisX * childBasis.forwardZ;
  childBasis.perpendicularZ = axisX * childBasis.forwardY - axisY * childBasis.forwardX;
  const perpendicularLength = prototypeOr(
    Math.hypot(childBasis.perpendicularX, childBasis.perpendicularY, childBasis.perpendicularZ),
    1,
  );
  childBasis.perpendicularX /= perpendicularLength;
  childBasis.perpendicularY /= perpendicularLength;
  childBasis.perpendicularZ /= perpendicularLength;
  childBasis.binormalX =
    childBasis.forwardY * childBasis.perpendicularZ -
    childBasis.forwardZ * childBasis.perpendicularY;
  childBasis.binormalY =
    childBasis.forwardZ * childBasis.perpendicularX -
    childBasis.forwardX * childBasis.perpendicularZ;
  childBasis.binormalZ =
    childBasis.forwardX * childBasis.perpendicularY -
    childBasis.forwardY * childBasis.perpendicularX;
}
