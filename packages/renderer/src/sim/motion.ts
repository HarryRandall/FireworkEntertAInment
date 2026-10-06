/** Closed-form star motion under drag, gravity and stored motion modifiers. */
import { prototypeOr } from './numeric';
import type { Layer } from '../schema/index';
import type { StarDirection } from './directions';
import type { Vec3 } from './colour';
// Prototype visual tuning: fish sideways amplitude, metres.
const FISH_WAVE_M = 1.4;
// Prototype visual tuning: fish motion onset, inverse seconds.
const FISH_RISE_PER_S = 3;
// Prototype visual tuning: vertical phase ratio, dimensionless.
const FISH_VERTICAL_RATE_RATIO = 0.7;
// Prototype visual tuning: vertical wiggle, metres.
const FISH_VERTICAL_M = 0.6;
// Prototype visual tuning: bee base phase speed, radians per second.
const BEE_RATE_RAD_S = 7;
// Prototype visual tuning: bee motion amplitude, metres.
const BEE_REACH_M = 2.2;
// Prototype bee motion onset, inverse seconds.
const BEE_RISE_PER_S = 2;
// Prototype bee axis phase offsets, radians.
const BEE_Y_PHASE_RAD = 1;
const BEE_Z_PHASE_RAD = 2;
// Prototype visual tuning: x primary phase ratio, dimensionless.
const BEE_X_RATE_RATIO = 1.3;
// Prototype visual tuning: x secondary phase ratio, dimensionless.
const BEE_X_HARMONIC_RATIO = 2.9;
// Prototype visual tuning: y primary phase ratio, dimensionless.
const BEE_Y_RATE_RATIO = 1.7;
// Prototype visual tuning: y secondary phase ratio, dimensionless.
const BEE_Y_HARMONIC_RATIO = 3.3;
// Prototype visual tuning: z primary phase ratio, dimensionless.
const BEE_Z_RATE_RATIO = 1.1;
// Prototype visual tuning: z secondary phase ratio, dimensionless.
const BEE_Z_HARMONIC_RATIO = 2.3;
// Prototype visual tuning: flutter onset, inverse seconds.
const FLUTTER_RISE_PER_S = 0.8;
// Prototype visual tuning: flutter amplitude relative to burst radius, dimensionless.
const FLUTTER_RADIUS_FRACTION = 0.12;
// Prototype visual tuning: x flutter speed, radians per second.
const FLUTTER_X_RAD_S = 4.4;
// Prototype visual tuning: z flutter speed, radians per second.
const FLUTTER_Z_RAD_S = 3.7;

/** Computes one star's world position in metres from its burst centre and age in seconds. */
export function starPos(layer: Layer, direction: StarDirection, age: number, centre: Vec3): Vec3 {
  const dragPerS = layer.drag_per_s;
  const speedFactor = 1 - layer.speed_var + layer.speed_var * direction.h;
  // Analytic exponential drag avoids integration drift during seeking.
  const dragFraction = 1 - Math.exp(-dragPerS * age);
  const distanceM = layer.radius_m * (direction.radius ?? 1) * speedFactor * dragFraction;
  const fallM = (layer.gravity_m_s2 / dragPerS) * (age - dragFraction / dragPerS);
  let directionX = direction.x;
  let directionY = direction.y;
  let directionZ = direction.z;
  for (const modifier of layer.modifiers)
    if (modifier.kind === 'twist') {
      const angleRad = modifier.angular_speed_rad_s * age;
      const angleCosine = Math.cos(angleRad);
      const angleSine = Math.sin(angleRad);
      if (layer.pattern === 'spiral') {
        const originalX = directionX;
        directionX = originalX * angleCosine - directionY * angleSine;
        directionY = originalX * angleSine + directionY * angleCosine;
      } else {
        const originalX = directionX;
        directionX = originalX * angleCosine + directionZ * angleSine;
        directionZ = -originalX * angleSine + directionZ * angleCosine;
      }
    }
  const out: Vec3 = [
    centre[0] + directionX * distanceM,
    centre[1] + directionY * distanceM - fallM,
    centre[2] + directionZ * distanceM,
  ];
  applyMotionModifiers(out, layer, direction, age);
  return out;
}

// Additive motion follows ordered twist and analytic travel on the burst-relative clock.
function applyMotionModifiers(
  out: Vec3,
  layer: Layer,
  direction: StarDirection,
  age: number,
): void {
  for (const modifier of layer.modifiers) {
    if (modifier.kind === 'fish') {
      const fishDisplacementM =
        Math.sin(age * modifier.rate_rad_s + direction.ph) *
        FISH_WAVE_M *
        modifier.amount *
        Math.min(1, age * FISH_RISE_PER_S);
      const directionLength = prototypeOr(Math.hypot(direction.x, direction.y), 1);
      out[0] += (-direction.y / directionLength) * fishDisplacementM;
      out[1] +=
        (direction.x / directionLength) * fishDisplacementM +
        Math.cos(age * modifier.rate_rad_s * FISH_VERTICAL_RATE_RATIO + direction.ph) *
          FISH_VERTICAL_M;
    } else if (modifier.kind === 'bees') {
      const beePhaseRad = age * BEE_RATE_RAD_S + direction.ph;
      const amplitudeM = Math.min(1, age * BEE_RISE_PER_S) * BEE_REACH_M;
      out[0] +=
        (Math.sin(beePhaseRad * BEE_X_RATE_RATIO) +
          Math.sin(beePhaseRad * BEE_X_HARMONIC_RATIO) * 0.5) *
        amplitudeM;
      out[1] +=
        (Math.sin(beePhaseRad * BEE_Y_RATE_RATIO + BEE_Y_PHASE_RAD) +
          Math.sin(beePhaseRad * BEE_Y_HARMONIC_RATIO) * 0.5) *
        amplitudeM;
      out[2] +=
        (Math.sin(beePhaseRad * BEE_Z_RATE_RATIO + BEE_Z_PHASE_RAD) +
          Math.sin(beePhaseRad * BEE_Z_HARMONIC_RATIO) * 0.5) *
        amplitudeM;
    } else if (modifier.kind === 'flutter') {
      const amplitudeM =
        Math.min(1, age * FLUTTER_RISE_PER_S) *
        FLUTTER_RADIUS_FRACTION *
        layer.radius_m *
        modifier.amount;
      out[0] += Math.sin(age * FLUTTER_X_RAD_S + direction.ph) * amplitudeM;
      out[2] += Math.cos(age * FLUTTER_Z_RAD_S + direction.ph) * amplitudeM;
    }
  }
}
