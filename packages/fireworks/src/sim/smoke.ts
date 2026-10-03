/** Muzzle, climb, burst and comet smoke sampled from source clocks with wind drift. */
import type { Launch, Layer } from '../schema/index';
import { colourAt, mix, type Vec3 } from './colour';
import type { LaunchStyle } from './launch-styles';
import type { ParticleWriter } from './particles';
import { hash } from './random';

// Prototype muzzle cloud random vertical expansion range, in metres.
const MUZZLE_HEIGHT_JITTER_M = 2;
// Prototype comet cloud horizontal jitter width, in metres.
const COMET_JITTER_M = 2;
// Prototype comet cloud initial radial expansion, dimensionless.
const COMET_EXPANSION_MIN = 0.5;
// Prototype muzzle cloud expansion speed, in inverse seconds.
const MUZZLE_GROWTH_PER_S = 1.6;
// Prototype muzzle cloud initial and added radial expansion, dimensionless.
const MUZZLE_EXPANSION_MIN = 0.6;
const MUZZLE_EXPANSION_RANGE = 1.6;
// Prototype muzzle puff birth height, in metres.
const MUZZLE_HEIGHT_M = 0.6;
// Prototype burst cloud initial radial expansion, dimensionless radius fraction.
const BURST_EXPANSION_MIN = 0.4;
// Prototype visual tuning: muzzle warm rgb (linear RGB).
const MUZZLE_WARM_RGB = [0.42, 0.24, 0.1] as Vec3;
// Prototype deterministic seed partition: muzzle seed step (dimensionless seed offset).
const MUZZLE_SEED_STEP = 0.37;
// Prototype deterministic seed partition: muzzle seed scale (dimensionless seed multiplier).
const MUZZLE_SEED_SCALE = 3.1;
// Prototype visual tuning: muzzle fade in s (seconds).
const MUZZLE_FADE_IN_S = 0.08;
// Prototype visual tuning: muzzle alpha (opacity).
const MUZZLE_ALPHA = 0.06;
// Prototype visual tuning: muzzle rise m s (m/s).
const MUZZLE_RISE_M_S = 0.35;
// Prototype visual tuning: muzzle size growth m (metres).
const MUZZLE_SIZE_GROWTH_M = 2.6;
// Prototype visual tuning: muzzle size m (metres).
const MUZZLE_SIZE_M = 0.9;
// Prototype visual tuning: muzzle radius range (metres).
const MUZZLE_RADIUS_RANGE_M = 1.6;
// Prototype visual tuning: muzzle radius minimum (metres).
const MUZZLE_RADIUS_MIN_M = 0.6;
// Prototype deterministic seed partition: muzzle height stream (dimensionless hash stream).
const MUZZLE_HEIGHT_STREAM = 7;
// Prototype visual tuning: muzzle height range m (metres).
const MUZZLE_HEIGHT_RANGE_M = 1.2;
// Prototype visual tuning: muzzle life s (seconds).
const MUZZLE_LIFE_S = 6;
// Prototype visual tuning: muzzle tau rad (radians, rounded full turn).
const MUZZLE_TAU_RAD = 6.2832;
// Prototype deterministic seed partition: muzzle angle stream (dimensionless hash stream).
const MUZZLE_ANGLE_STREAM = 5;
// Prototype visual tuning: muzzle light s (seconds).
const MUZZLE_LIGHT_S = 0.3;
// Prototype visual tuning: muzzle interval s (seconds).
const MUZZLE_INTERVAL_S = 0.03;
// Prototype visual tuning: muzzle puff count (puffs).
const MUZZLE_PUFF_COUNT = 12;
// Prototype deterministic seed partition: muzzle radius stream (dimensionless hash stream).
const MUZZLE_RADIUS_STREAM = 6;
// Prototype deterministic seed partition: climb seed step (dimensionless seed offset).
const CLIMB_SEED_STEP = 0.61;
// Prototype deterministic seed partition: climb seed scale (dimensionless seed multiplier).
const CLIMB_SEED_SCALE = 5.3;
// Prototype visual tuning: climb alpha (opacity).
const CLIMB_ALPHA = 0.03;
// Prototype visual tuning: climb growth m s (m/s).
const CLIMB_GROWTH_M_S = 0.9;
// Prototype visual tuning: climb size m (metres).
const CLIMB_SIZE_M = 0.35;
// Prototype visual tuning: climb jitter m (metres).
const CLIMB_JITTER_M = 0.6;
// Prototype deterministic seed partition: climb z stream (dimensionless hash stream).
const CLIMB_Z_STREAM = 9;
// Prototype visual tuning: climb rise m s (m/s).
const CLIMB_RISE_M_S = 0.25;
// Prototype deterministic seed partition: climb x stream (dimensionless hash stream).
const CLIMB_X_STREAM = 8;
// Prototype visual tuning: climb life s (seconds).
const CLIMB_LIFE_S = 4;
// Prototype visual tuning: climb interval s (seconds).
const CLIMB_INTERVAL_S = 0.025;
// Prototype visual tuning: climb time jitter (interval fraction).
const CLIMB_TIME_JITTER = 0.8;
// Prototype deterministic seed partition: climb time stream (dimensionless hash stream).
const CLIMB_TIME_STREAM = 10;
// Prototype deterministic seed partition: burst puff seed step (dimensionless seed offset).
const BURST_PUFF_SEED_STEP = 0.53;
// Prototype deterministic seed partition: burst layer seed step (dimensionless seed offset).
const BURST_LAYER_SEED_STEP = 3.3;
// Prototype deterministic seed partition: burst seed scale (dimensionless seed multiplier).
const BURST_SEED_SCALE = 7.7;
// Prototype visual tuning: burst fade in s (seconds).
const BURST_FADE_IN_S = 0.15;
// Prototype visual tuning: burst start s (seconds).
const BURST_START_S = 0.25;
// Prototype visual tuning: burst alpha (opacity).
const BURST_ALPHA = 0.012;
// Prototype visual tuning: burst size rate m s (m/s).
const BURST_SIZE_RATE_M_S = 0.8;
// Prototype visual tuning: burst size growth (radius fraction).
const BURST_SIZE_GROWTH = 0.22;
// Prototype visual tuning: burst size min (radius fraction).
const BURST_SIZE_MIN = 0.14;
// Prototype visual tuning: burst light s (seconds).
const BURST_LIGHT_S = 0.5;
// Prototype visual tuning: burst fall m s (m/s).
const BURST_FALL_M_S = 0.3;
// Prototype visual tuning: burst vertical scale (dimensionless vertical flattening).
const BURST_VERTICAL_SCALE = 0.7;
// Prototype visual tuning: burst radius growth (radius fraction).
const BURST_RADIUS_GROWTH = 0.6;
// Prototype visual tuning: burst radius range (radius fraction).
const BURST_RADIUS_RANGE = 0.4;
// Prototype deterministic seed partition: burst radius stream (dimensionless hash stream).
const BURST_RADIUS_STREAM = 72;
// Prototype visual tuning: burst radius min (radius fraction).
const BURST_RADIUS_MIN = 0.12;
// Prototype deterministic seed partition: burst vertical stream (dimensionless hash stream).
const BURST_VERTICAL_STREAM = 74;
// Prototype visual tuning: burst tau rad (radians, rounded full turn).
const BURST_TAU_RAD = 6.283;
// Prototype deterministic seed partition: burst angle stream (dimensionless hash stream).
const BURST_ANGLE_STREAM = 71;
// Prototype visual tuning: burst growth per s (1/s).
const BURST_GROWTH_PER_S = 2.2;
// Prototype visual tuning: burst life s (seconds).
const BURST_LIFE_S = 7;
// Prototype visual tuning: burst interval s (seconds).
const BURST_INTERVAL_S = 0.03;
// Prototype visual tuning: burst puff count (puffs).
const BURST_PUFF_COUNT = 14;
// Prototype deterministic seed partition: comet puff seed step (dimensionless seed offset).
const COMET_PUFF_SEED_STEP = 0.41;
// Prototype deterministic seed partition: comet emitter seed step (dimensionless seed offset).
const COMET_EMITTER_SEED_STEP = 1.7;
// Prototype deterministic seed partition: comet seed scale (dimensionless seed multiplier).
const COMET_SEED_SCALE = 2.9;
// Prototype visual tuning: comet life s (seconds).
const COMET_LIFE_S = 5;
// Prototype visual tuning: comet alpha (opacity).
const COMET_ALPHA = 0.08;
// Prototype visual tuning: comet size growth m (metres).
const COMET_SIZE_GROWTH_M = 2.2;
// Prototype visual tuning: comet size m (metres).
const COMET_SIZE_M = 0.9;
// Prototype deterministic seed partition: comet z stream (dimensionless hash stream).
const COMET_Z_STREAM = 82;
// Prototype visual tuning: comet rise m s (m/s).
const COMET_RISE_M_S = 0.3;
// Prototype visual tuning: comet height growth m (metres).
const COMET_HEIGHT_GROWTH_M = 1.8;
// Prototype visual tuning: comet height m (metres).
const COMET_HEIGHT_M = 0.6;
// Prototype deterministic seed partition: comet x stream (dimensionless hash stream).
const COMET_X_STREAM = 81;
// Prototype visual tuning: comet growth per s (1/s).
const COMET_GROWTH_PER_S = 1.6;
// Prototype visual tuning: comet interval s (seconds).
const COMET_INTERVAL_S = 0.04;
// Prototype visual tuning: comet puff count (puffs).
const COMET_PUFF_COUNT = 8;
// Prototype visual tuning: comet fade in s (seconds).
const COMET_FADE_IN_S = 0.08;

/** Prototype positive-x smoke drift in m/s, retained visual wind tuning. */
export const WIND = 0.9;
/** Prototype unlit smoke colour in linear RGB, chosen for dark smoke billboards. */
export const SMOKE_RGB: Vec3 = [0.014, 0.015, 0.02];
/** Appends muzzle and climb puffs at local seconds from launch firing.
 * launch and st supply authored and style opacity; seed is dimensionless,
 * px/pz are horizontal metres and path samples launch positions in metres. */
export function launchSmoke(
  writer: ParticleWriter,
  launch: Launch,
  st: LaunchStyle,
  seed: number,
  px: number,
  pz: number,
  local: number,
  path: (time: number) => Vec3,
): void {
  if (!writer.smokeEnabled) return;
  const T = launch.time_s;
  const sm = launch.smoke;
  if (sm > 0) {
    const base = SMOKE_RGB,
      warm = MUZZLE_WARM_RGB;
    for (let i = 0; i < MUZZLE_PUFF_COUNT; i++) {
      const te = i * MUZZLE_INTERVAL_S;
      if (te > local) break;
      const age = local - te;
      if (age > MUZZLE_LIFE_S) continue;
      const u = age / MUZZLE_LIFE_S,
        lit = Math.max(0, 1 - age / MUZZLE_LIGHT_S);
      const a = hash(i, seed, MUZZLE_ANGLE_STREAM) * MUZZLE_TAU_RAD,
        r = MUZZLE_RADIUS_MIN_M + MUZZLE_RADIUS_RANGE_M * hash(i, seed, MUZZLE_RADIUS_STREAM);
      const grow = 1 - Math.exp(-age * MUZZLE_GROWTH_PER_S);
      writer.smoke(
        px + Math.cos(a) * r * (MUZZLE_EXPANSION_MIN + grow * MUZZLE_EXPANSION_RANGE) + WIND * age,
        MUZZLE_HEIGHT_M +
          grow *
            (MUZZLE_HEIGHT_RANGE_M + MUZZLE_HEIGHT_JITTER_M * hash(i, seed, MUZZLE_HEIGHT_STREAM)) +
          age * MUZZLE_RISE_M_S,
        pz + Math.sin(a) * r * (MUZZLE_EXPANSION_MIN + grow * MUZZLE_EXPANSION_RANGE),
        mix(base, warm, lit),
        MUZZLE_SIZE_M + grow * MUZZLE_SIZE_GROWTH_M + age * MUZZLE_RISE_M_S,
        MUZZLE_ALPHA * sm * Math.min(1, age / MUZZLE_FADE_IN_S) * (1 - u) * (1 - u),
        seed * MUZZLE_SEED_SCALE + i * MUZZLE_SEED_STEP,
        age,
      );
    }
    for (let k = 0; k < T / CLIMB_INTERVAL_S; k++) {
      const te = (k + hash(k, seed, CLIMB_TIME_STREAM) * CLIMB_TIME_JITTER) * CLIMB_INTERVAL_S;
      if (te > local) break;
      const age = local - te;
      if (age > CLIMB_LIFE_S) continue;
      const tA = path(te);
      const u = age / CLIMB_LIFE_S,
        j = hash(k, seed, CLIMB_X_STREAM) - 0.5;
      writer.smoke(
        tA[0] + WIND * age + j * CLIMB_JITTER_M,
        tA[1] + age * CLIMB_RISE_M_S,
        tA[2] + (hash(k, seed, CLIMB_Z_STREAM) - 0.5) * CLIMB_JITTER_M,
        base,
        CLIMB_SIZE_M + age * CLIMB_GROWTH_M_S,
        CLIMB_ALPHA * sm * st.smoke * (1 - u) * (1 - u),
        seed * CLIMB_SEED_SCALE + k * CLIMB_SEED_STEP,
        age,
      );
    }
  }
}
/** Appends a flash-lit burst cloud at local seconds since layer ignition.
 * centre is metres, smoke is an opacity multiplier and seed/li partition noise
 * by design and flattened layer index; layer supplies radius and flash controls. */
export function burstSmoke(
  writer: ParticleWriter,
  layer: Layer,
  seed: number,
  li: number,
  local: number,
  centre: Vec3,
  smoke: number,
): void {
  if (!writer.smokeEnabled || smoke <= 0 || !layer.flash) return;
  const [cx, cy, cz] = centre,
    R = layer.radius_m;
  const bc = colourAt(layer.colour, 0, 0, 0);
  for (let i = 0; i < BURST_PUFF_COUNT; i++) {
    const age = local - i * BURST_INTERVAL_S;
    if (age < BURST_START_S || age > BURST_LIFE_S) continue;
    const u = age / BURST_LIFE_S,
      lit = Math.max(0, 1 - age / BURST_LIGHT_S);
    const grow = 1 - Math.exp(-age * BURST_GROWTH_PER_S);
    const a1 = hash(i, seed, BURST_ANGLE_STREAM) * BURST_TAU_RAD,
      a2 = hash(i, seed, BURST_VERTICAL_STREAM) * 2 - 1,
      rr =
        R *
        (BURST_RADIUS_MIN + BURST_RADIUS_RANGE * hash(i, seed, BURST_RADIUS_STREAM)) *
        (BURST_EXPANSION_MIN + BURST_RADIUS_GROWTH * grow);
    const q2 = Math.sqrt(1 - a2 * a2);
    writer.smoke(
      cx + Math.cos(a1) * q2 * rr + WIND * age,
      cy + a2 * rr * BURST_VERTICAL_SCALE - age * BURST_FALL_M_S,
      cz + Math.sin(a1) * q2 * rr,
      mix(SMOKE_RGB, [bc[0] * 0.5, bc[1] * 0.5, bc[2] * 0.5], lit),
      R * (BURST_SIZE_MIN + BURST_SIZE_GROWTH * grow) + age * BURST_SIZE_RATE_M_S,
      BURST_ALPHA *
        smoke *
        Math.min(1, (age - BURST_START_S) / BURST_FADE_IN_S) *
        (1 - u) *
        (1 - u),
      seed * BURST_SEED_SCALE + li * BURST_LAYER_SEED_STEP + i * BURST_PUFF_SEED_STEP,
      age,
    );
  }
}
/** Appends a comet muzzle cloud at lt seconds since that emitter fired.
 * px/pz are horizontal metres; seed and emitter index i partition puff noise. */
export function cometSmoke(
  writer: ParticleWriter,
  seed: number,
  i: number,
  px: number,
  pz: number,
  lt: number,
): void {
  if (!writer.smokeEnabled) return;
  for (let k = 0; k < COMET_PUFF_COUNT; k++) {
    const age = lt - k * COMET_INTERVAL_S;
    if (age < 0 || age > COMET_LIFE_S) continue;
    const grow = 1 - Math.exp(-age * COMET_GROWTH_PER_S);
    writer.smoke(
      px +
        WIND * age +
        (hash(k, i, COMET_X_STREAM) - 0.5) * COMET_JITTER_M * (COMET_EXPANSION_MIN + grow),
      COMET_HEIGHT_M + grow * COMET_HEIGHT_GROWTH_M + age * COMET_RISE_M_S,
      pz + (hash(k, i, COMET_Z_STREAM) - 0.5) * COMET_JITTER_M * (COMET_EXPANSION_MIN + grow),
      SMOKE_RGB,
      COMET_SIZE_M + grow * COMET_SIZE_GROWTH_M,
      COMET_ALPHA * Math.min(1, age / COMET_FADE_IN_S) * (1 - age / COMET_LIFE_S) ** 2,
      seed * COMET_SEED_SCALE + i * COMET_EMITTER_SEED_STEP + k * COMET_PUFF_SEED_STEP,
      age,
    );
  }
}
