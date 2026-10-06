/** Resolves launch quick controls within the stored schema limits. */
import type { Design } from './design.generated';
import { clampControl as clamp, roundedControl as rounded } from './adjustment-bounds';

// Prototype ADJ climb multiplier per level, dimensionless.
const CLIMB_FACTOR = 0.85;
// Validated v1 min duration bound, seconds.
const MIN_DURATION_S = 0.001;
// Validated v1 max height bound, metres.
const MAX_HEIGHT_M = 1000;
// Validated v1 max duration bound, seconds.
const MAX_DURATION_S = 120;
// Prototype ADJ max star count bound, particles.
const MAX_STAR_COUNT = 10000;
// Prototype ADJ launch height multiplier per level, dimensionless.
const LAUNCH_HEIGHT_FACTOR = 1.12;
// Prototype ADJ launch spark multiplier per level, dimensionless.
const LAUNCH_SPARK_FACTOR = 1.35;
// Prototype ADJ launch spread multiplier per level, dimensionless.
const LAUNCH_SPREAD_FACTOR = 1.15;
// Prototype ADJ max launch spread control bound, dimensionless authored units.
const MAX_LAUNCH_SPREAD = 20;
// Prototype ADJ break flash multiplier per level, dimensionless.
const BREAK_FLASH_FACTOR = 1.3;
// Prototype ADJ max break flash control bound, dimensionless authored units.
const MAX_BREAK_FLASH = 10;
// Prototype ADJ core radius multiplier per level, dimensionless.
const CORE_RADIUS_FACTOR = 1.15;
// Prototype ADJ max core radius control bound, dimensionless authored units.
const MAX_CORE_RADIUS = 4;

/** Mutates validated design controls by a dimensionless level; retains stored field units and schema bounds. */
export function adjustLaunch(resolved: Design, key: string, level: number): void {
  if (resolved.launch) {
    if (key === 'launch.height') {
      const factor = LAUNCH_HEIGHT_FACTOR ** level;
      resolved.launch.height_m = clamp(resolved.launch.height_m * factor, 0, MAX_HEIGHT_M);
      resolved.launch.time_s = clamp(
        resolved.launch.time_s * Math.sqrt(factor),
        MIN_DURATION_S,
        MAX_DURATION_S,
      );
    }
    if (key === 'launch.tail') {
      resolved.launch.sparks = rounded(
        resolved.launch.sparks * LAUNCH_SPARK_FACTOR ** level,
        0,
        MAX_STAR_COUNT,
      );
      resolved.launch.spread = clamp(
        resolved.launch.spread * LAUNCH_SPREAD_FACTOR ** level,
        0,
        MAX_LAUNCH_SPREAD,
      );
    }
    if (key === 'launch.climb')
      resolved.launch.time_s = clamp(
        resolved.launch.time_s * CLIMB_FACTOR ** level,
        MIN_DURATION_S,
        MAX_DURATION_S,
      );
  }
}

/** Mutates validated design controls by a dimensionless level; retains stored field units and schema bounds. */
export function adjustBreaks(resolved: Design, key: string, level: number): void {
  if (key === 'break.flash')
    for (const break_ of resolved.breaks)
      break_.core.flash = clamp(
        break_.core.flash * BREAK_FLASH_FACTOR ** level,
        0,
        MAX_BREAK_FLASH,
      );
  if (key === 'break.core_ring')
    for (const break_ of resolved.breaks)
      break_.core.radius = clamp(
        break_.core.radius * CORE_RADIUS_FACTOR ** level,
        0,
        MAX_CORE_RADIUS,
      );
}
