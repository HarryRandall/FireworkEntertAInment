/** Launch-tail sprays, rocket flame, rising blossoms and climb crackle share the launch path. */
import type { Design, Launch } from '../schema/index';
import { mix, rgb, WHITE, type Vec3 } from './colour';
import { unit } from './directions';
import { launchPos, type ShotPlacement } from './launch';
import { LAUNCH_STYLES } from './launch-styles';
import type { ParticleWriter } from './particles';
import { hash } from './random';
import { spray } from './spray';
import { launchSmoke } from './smoke';

// Prototype blossom quadratic fall coefficient, in m/s² (half the acceleration).
const BLOSSOM_FALL_M_S2 = 1;
// Prototype visual tuning: climb crackle rgb (linear RGB).
const CLIMB_CRACKLE_RGB = [1, 0.85, 0.55] as Vec3;
// Prototype deterministic seed partition: launch seed scale (dimensionless seed multiplier).
const LAUNCH_SEED_SCALE = 7;
// Prototype deterministic seed partition: launch seed offset (dimensionless seed offset).
const LAUNCH_SEED_OFFSET = 1;
// Prototype visual tuning: star tail mix (linear RGB fraction).
const STAR_TAIL_MIX = 0.3;
// Prototype visual tuning: launch inherit (velocity fraction).
const LAUNCH_INHERIT = 0.3;
// Prototype visual tuning: launch cluster (sparks per slot).
const LAUNCH_CLUSTER = 8;
// Prototype visual tuning: launch size factor (size multiplier).
const LAUNCH_SIZE_FACTOR = 1.3;
// Prototype visual tuning: launch drag per s (1/s).
const LAUNCH_DRAG_PER_S = 2.4;
// Prototype visual tuning: launch life factor (life multiplier).
const LAUNCH_LIFE_FACTOR = 1.35;
// Prototype visual tuning: flame samples (points).
const FLAME_SAMPLES = 12;
// Prototype visual tuning: flame alpha (opacity multiplier).
const FLAME_ALPHA = 1.5;
// Prototype visual tuning: flame size decay samples (points).
const FLAME_SIZE_DECAY_SAMPLES = 18;
// Prototype visual tuning: flame size (renderer size).
const FLAME_SIZE = 1.1;
// Prototype visual tuning: flame interval s (seconds).
const FLAME_INTERVAL_S = 0.012;
// Prototype visual tuning: blossom star alpha (opacity multiplier).
const BLOSSOM_STAR_ALPHA = 1.5;
// Prototype visual tuning: blossom star size (renderer size).
const BLOSSOM_STAR_SIZE = 0.7;
// Prototype deterministic seed partition: blossom seed offset (dimensionless seed offset).
const BLOSSOM_SEED_OFFSET = 83;
// Prototype deterministic seed partition: blossom key stride (dimensionless key multiplier).
const BLOSSOM_KEY_STRIDE = 32;
// Prototype visual tuning: blossom stars (stars per blossom).
const BLOSSOM_STARS = 14;
// Prototype visual tuning: blossom expansion per s (1/s).
const BLOSSOM_EXPANSION_PER_S = 6;
// Prototype visual tuning: blossom fade power (dimensionless exponent).
const BLOSSOM_FADE_POWER = 1.3;
// Prototype visual tuning: blossom flash s (seconds).
const BLOSSOM_FLASH_S = 0.05;
// Prototype visual tuning: blossom flash alpha (opacity).
const BLOSSOM_FLASH_ALPHA = 0.4;
// Prototype visual tuning: blossom flash size (renderer size).
const BLOSSOM_FLASH_SIZE = 1.6;
// Prototype deterministic seed partition: blossom time stream (dimensionless hash stream).
const BLOSSOM_TIME_STREAM = 81;
// Prototype visual tuning: blossom jitter (slot fraction).
const BLOSSOM_JITTER = 0.6;
// Prototype visual tuning: blossom window (climb fraction).
const BLOSSOM_WINDOW = 0.65;
// Prototype visual tuning: blossom start (climb fraction).
const BLOSSOM_START = 0.25;
// Prototype visual tuning: blossom colour per s (1/s colour transition rate).
const BLOSSOM_COLOUR_PER_S = 6;
// Prototype visual tuning: climb crackle alpha (opacity multiplier).
const CLIMB_CRACKLE_ALPHA = 2.2;
// Prototype visual tuning: climb crackle size (renderer size).
const CLIMB_CRACKLE_SIZE = 0.9;
// Prototype visual tuning: climb crackle reach m (metres).
const CLIMB_CRACKLE_REACH_M = 3;
// Prototype deterministic seed partition: climb crackle z stream (dimensionless hash stream).
const CLIMB_CRACKLE_Z_STREAM = 65;
// Prototype deterministic seed partition: climb crackle y stream (dimensionless hash stream).
const CLIMB_CRACKLE_Y_STREAM = 64;
// Prototype deterministic seed partition: climb crackle x stream (dimensionless hash stream).
const CLIMB_CRACKLE_X_STREAM = 63;
// Prototype visual tuning: climb crackle life s (seconds).
const CLIMB_CRACKLE_LIFE_S = 0.06;
// Prototype deterministic seed partition: climb crackle delay stream (dimensionless hash stream).
const CLIMB_CRACKLE_DELAY_STREAM = 66;
// Prototype visual tuning: climb crackle delay range s (seconds).
const CLIMB_CRACKLE_DELAY_RANGE_S = 0.35;
// Prototype visual tuning: climb crackle delay s (seconds).
const CLIMB_CRACKLE_DELAY_S = 0.15;
// Prototype deterministic seed partition: climb crackle skip stream (dimensionless hash stream).
const CLIMB_CRACKLE_SKIP_STREAM = 62;
// Prototype visual tuning: climb crackle interval s (seconds).
const CLIMB_CRACKLE_INTERVAL_S = 0.03;
// Prototype deterministic seed partition: climb crackle time stream (dimensionless hash stream).
const CLIMB_CRACKLE_TIME_STREAM = 61;
// Prototype visual tuning: climb crackle fall m s (m/s).
const CLIMB_CRACKLE_FALL_M_S = 2;
// Prototype visual tuning: climb crackle drop m (metres).
const CLIMB_CRACKLE_DROP_M = 1;

function push(
  writer: ParticleWriter,
  x: number,
  y: number,
  z: number,
  c: Vec3,
  size: number,
  alpha: number,
): void {
  writer.spark([x, y, z], c, size, alpha);
}
function glow(
  writer: ParticleWriter,
  x: number,
  y: number,
  z: number,
  c: Vec3,
  size: number,
  alpha: number,
): void {
  writer.glow([x, y, z], c, size, alpha);
}
/** Appends launch sprays and embellishments at local seconds from firing.
 * The validated design supplies the burst palette; launch supplies source tuning.
 * seed is dimensionless and placement is horizontal metres plus muzzle metres. */
export function fillLaunchSpray(
  writer: ParticleWriter,
  design: Design,
  launch: Launch,
  seed: number,
  local: number,
  placement: ShotPlacement,
): void {
  const st = LAUNCH_STYLES[launch.tail],
    T = launch.time_s;
  const first = design.breaks[0]?.layers[0]?.colour.stops[0]?.[1];
  const palette = typeof first === 'string' ? [first] : first;
  const star = rgb(palette?.[0] ?? '#ffe2a8');
  const tailC = st.colour
    ? rgb(st.colour)
    : st.star
      ? mix(rgb('#ffc070'), star, STAR_TAIL_MIX)
      : rgb('#ffe2a8');
  const path = (time: number): Vec3 => launchPos(launch, seed, time, placement);
  spray(writer, path, 0, T, local, {
    count: Math.round(launch.sparks * st.sparks),
    life: st.life * LAUNCH_LIFE_FACTOR,
    spread: launch.spread * st.spread,
    gravity: st.gravity,
    drag: st.drag ?? LAUNCH_DRAG_PER_S,
    size: LAUNCH_SIZE_FACTOR * st.size,
    flicker: st.flicker,
    glitter: st.glitter,
    glitterDelay: st.glitterDelay,
    fork: st.fork,
    colour: tailC,
    seed: seed * LAUNCH_SEED_SCALE + LAUNCH_SEED_OFFSET,
    inherit: st.inherit ?? LAUNCH_INHERIT,
    cluster: LAUNCH_CLUSTER,
  });
  // A rocket motor: a short, dense, white-hot flame under the head.
  if (writer.launchEffects && st.flame && local < T) {
    const fc = rgb('#ffd38a');
    for (let j = 0; j < FLAME_SAMPLES; j++) {
      const tt = local - j * FLAME_INTERVAL_S;
      if (tt < 0) break;
      const tA = path(tt);
      push(
        writer,
        tA[0],
        tA[1],
        tA[2],
        mix(WHITE, fc, j / FLAME_SAMPLES),
        FLAME_SIZE * (1 - j / FLAME_SIZE_DECAY_SAMPLES),
        FLAME_ALPHA * (1 - j / FLAME_SAMPLES),
      );
    }
  }
  // Rising flowers: small coloured blossoms pop off the climb.
  if (writer.launchEffects && st.blossoms) {
    const B = st.blossoms,
      pal = (B.colours || palette || ['#ff3048']).map(rgb);
    for (let k = 0; k < B.count; k++) {
      const te =
        T *
        (BLOSSOM_START +
          (BLOSSOM_WINDOW * (k + BLOSSOM_JITTER * hash(k, seed, BLOSSOM_TIME_STREAM))) / B.count);
      const pt = local - te;
      if (pt < 0 || pt > B.life) continue;
      const tC = path(te);
      if (pt < BLOSSOM_FLASH_S)
        glow(
          writer,
          tC[0],
          tC[1],
          tC[2],
          WHITE,
          BLOSSOM_FLASH_SIZE,
          BLOSSOM_FLASH_ALPHA * (1 - pt / BLOSSOM_FLASH_S),
        );
      const e = B.radius * (1 - Math.exp(-BLOSSOM_EXPANSION_PER_S * pt)),
        ka = Math.pow(1 - pt / B.life, BLOSSOM_FADE_POWER),
        bc = mix(WHITE, pal[k % pal.length]!, Math.min(1, pt * BLOSSOM_COLOUR_PER_S));
      for (let c = 0; c < BLOSSOM_STARS; c++) {
        const tU = unit(k * BLOSSOM_KEY_STRIDE + c, seed + BLOSSOM_SEED_OFFSET);
        push(
          writer,
          tC[0] + tU[0] * e,
          tC[1] + tU[1] * e - BLOSSOM_FALL_M_S2 * pt * pt,
          tC[2] + tU[2] * e,
          bc,
          BLOSSOM_STAR_SIZE,
          BLOSSOM_STAR_ALPHA * ka,
        );
      }
    }
  }
  if (writer.launchEffects && st.crackle) {
    // Pellets dropped along the climb, each going off once with a sharp pop.
    for (let k = 0; k < T / CLIMB_CRACKLE_INTERVAL_S; k++) {
      const te =
        k * CLIMB_CRACKLE_INTERVAL_S +
        hash(k, seed, CLIMB_CRACKLE_TIME_STREAM) * CLIMB_CRACKLE_INTERVAL_S;
      if (te > local || hash(k, seed, CLIMB_CRACKLE_SKIP_STREAM) < STAR_TAIL_MIX) continue;
      const tp =
          te +
          CLIMB_CRACKLE_DELAY_S +
          CLIMB_CRACKLE_DELAY_RANGE_S * hash(k, seed, CLIMB_CRACKLE_DELAY_STREAM),
        age = local - tp;
      if (age < 0 || age > CLIMB_CRACKLE_LIFE_S) continue;
      const tA = path(te);
      const kk = 1 - age / CLIMB_CRACKLE_LIFE_S;
      push(
        writer,
        tA[0] + (hash(k, seed, CLIMB_CRACKLE_X_STREAM) - 0.5) * CLIMB_CRACKLE_REACH_M,
        tA[1] -
          CLIMB_CRACKLE_DROP_M -
          hash(k, seed, CLIMB_CRACKLE_Y_STREAM) * CLIMB_CRACKLE_REACH_M -
          CLIMB_CRACKLE_FALL_M_S * (tp - te),
        tA[2] + (hash(k, seed, CLIMB_CRACKLE_Z_STREAM) - 0.5) * CLIMB_CRACKLE_REACH_M,
        CLIMB_CRACKLE_RGB,
        CLIMB_CRACKLE_SIZE,
        CLIMB_CRACKLE_ALPHA * kk * kk,
      );
    }
  }

  const [px, pz] = placement.position ?? [0, 0];
  launchSmoke(writer, launch, st, seed, px, pz, local, path);
}
