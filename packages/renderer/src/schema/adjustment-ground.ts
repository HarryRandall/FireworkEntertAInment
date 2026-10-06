/** Resolves ground quick controls within the stored schema limits. */
import type { Design } from './design.generated';
import { clampControl as clamp, roundedControl as rounded } from './adjustment-bounds';

// Prototype ADJ climb multiplier per level, dimensionless.
const CLIMB_FACTOR = 0.85;
// Prototype ADJ fountain speed multiplier per level, dimensionless.
const FOUNTAIN_SPEED_FACTOR = 1.1;
// Validated v1 min duration bound, seconds.
const MIN_DURATION_S = 0.001;
// Validated v1 max height bound, metres.
const MAX_HEIGHT_M = 1000;
// Validated v1 max duration bound, seconds.
const MAX_DURATION_S = 120;
// Validated v1 ejection speed upper bound, metres per second.
const MAX_SPREAD_M_S = 200;
// Validated v1 fountain emission upper bound, particles per second.
const MAX_FOUNTAIN_RATE_PER_S = 20000;
// Prototype ADJ fan angle bound or initial spread, degrees.
const DEFAULT_FAN_DEG = 12;
// Validated v1 angular-speed upper bound, radians per second.
const MAX_ANGULAR_SPEED_RAD_S = 500;
// Prototype ADJ ground height multiplier per level, dimensionless.
const GROUND_HEIGHT_FACTOR = 1.12;
// Prototype ADJ max ground count bound, particles.
const MAX_GROUND_COUNT = 500;
// Prototype ADJ comet large count threshold bound, particles.
const COMET_LARGE_COUNT_THRESHOLD = 3;
// Prototype ADJ comet fan multiplier per level, dimensionless.
const COMET_FAN_FACTOR = 1.25;
// Prototype ADJ fan angle bound or initial spread, degrees.
const MAX_FAN_SPREAD_DEG = 120;
// Validated v1 min height bound, metres.
const MIN_HEIGHT_M = 0.001;
// Prototype ADJ tourbillon spin multiplier per level, dimensionless.
const TOURBILLON_SPIN_FACTOR = 1.25;
// Prototype ADJ fountain duration multiplier per level, dimensionless.
const FOUNTAIN_DURATION_FACTOR = 1.2;
// Prototype ADJ fountain rate multiplier per level, dimensionless.
const FOUNTAIN_RATE_FACTOR = 1.25;
// Prototype ADJ max fountain cone control bound, dimensionless authored units.
const MAX_FOUNTAIN_CONE = 4;
// Prototype ADJ fountain cone multiplier per level, dimensionless.
const FOUNTAIN_CONE_FACTOR = 1.25;

// Prototype ADJ comet head size multiplier per level, dimensionless.
const COMET_SIZE_FACTOR = 1.15;
// Validated v1 head-size upper bound, renderer units.
const MAX_HEAD_SIZE = 10;
// Prototype ADJ comet spin increment per level, radians per second.
const COMET_SPIN_STEP_RAD_S = 4;

/** Mutates validated design controls by a dimensionless level; retains stored field units and schema bounds. */
export function adjustGround(resolved: Design, key: string, level: number): void {
  adjustComets(resolved, key, level);
  adjustTourbillon(resolved, key, level);
  adjustFountain(resolved, key, level);
}

function adjustComets(resolved: Design, key: string, level: number): void {
  if (resolved.kind === 'comet' || resolved.kind === 'candle') {
    const comets = resolved.ground.comets;
    if (key === 'ground.height') {
      const factor = GROUND_HEIGHT_FACTOR ** level;
      comets.height_m = clamp(comets.height_m * factor, MIN_HEIGHT_M, MAX_HEIGHT_M);
      comets.time_s = clamp(comets.time_s * Math.sqrt(factor), MIN_DURATION_S, MAX_DURATION_S);
    }
    if (key === 'ground.count')
      comets.count = rounded(
        comets.count + level * (comets.count > COMET_LARGE_COUNT_THRESHOLD ? 2 : 1),
        1,
        MAX_GROUND_COUNT,
      );
    if (key === 'ground.fan') {
      const spread = startingFan(comets.spread_deg, level);
      comets.spread_deg = clamp(spread * COMET_FAN_FACTOR ** level, 0, MAX_FAN_SPREAD_DEG);
    }
    adjustCometMotion(comets, key, level);
  }
}

function adjustTourbillon(resolved: Design, key: string, level: number): void {
  if (resolved.kind === 'tourbillon') {
    const tourbillon = resolved.ground.tourbillon;
    if (key === 'ground.height') {
      const factor = GROUND_HEIGHT_FACTOR ** level;
      tourbillon.height_m = clamp(tourbillon.height_m * factor, MIN_HEIGHT_M, MAX_HEIGHT_M);
      tourbillon.time_s = clamp(
        tourbillon.time_s * Math.sqrt(factor),
        MIN_DURATION_S,
        MAX_DURATION_S,
      );
    }
    if (key === 'ground.count')
      tourbillon.count = rounded(tourbillon.count + level, 1, MAX_GROUND_COUNT);
    if (key === 'ground.climb')
      tourbillon.time_s = clamp(
        tourbillon.time_s * CLIMB_FACTOR ** level,
        MIN_DURATION_S,
        MAX_DURATION_S,
      );
    if (key === 'ground.spin')
      tourbillon.spin_rad_s = clamp(
        tourbillon.spin_rad_s * TOURBILLON_SPIN_FACTOR ** level,
        0,
        MAX_ANGULAR_SPEED_RAD_S,
      );
  }
}

function adjustFountain(resolved: Design, key: string, level: number): void {
  if (resolved.kind === 'fountain') {
    const fountain = resolved.ground.fountain;
    if (key === 'ground.height')
      fountain.speed_m_s = clamp(
        fountain.speed_m_s * FOUNTAIN_SPEED_FACTOR ** level,
        0,
        MAX_SPREAD_M_S,
      );
    if (key === 'ground.duration')
      fountain.duration_s = clamp(
        fountain.duration_s * FOUNTAIN_DURATION_FACTOR ** level,
        MIN_DURATION_S,
        MAX_DURATION_S,
      );
    if (key === 'ground.density')
      fountain.rate_per_s = clamp(
        fountain.rate_per_s * FOUNTAIN_RATE_FACTOR ** level,
        0,
        MAX_FOUNTAIN_RATE_PER_S,
      );
    if (key === 'ground.spray')
      fountain.cone = clamp(fountain.cone * FOUNTAIN_CONE_FACTOR ** level, 0, MAX_FOUNTAIN_CONE);
  }
}

function adjustCometMotion(
  comets: Extract<Design, { kind: 'comet' | 'candle' }>['ground']['comets'],
  key: string,
  level: number,
): void {
  if (key === 'ground.climb')
    comets.time_s = clamp(comets.time_s * CLIMB_FACTOR ** level, MIN_DURATION_S, MAX_DURATION_S);
  if (key === 'ground.star_size')
    comets.size = clamp(comets.size * COMET_SIZE_FACTOR ** level, 0, MAX_HEAD_SIZE);
  if (key === 'ground.spin')
    comets.spin_rad_s = clamp(
      comets.spin_rad_s + level * COMET_SPIN_STEP_RAD_S,
      0,
      MAX_ANGULAR_SPEED_RAD_S,
    );
}

function startingFan(spread: number, level: number): number {
  if (spread !== 0) return spread;
  return level > 0 ? DEFAULT_FAN_DEG : 0;
}
