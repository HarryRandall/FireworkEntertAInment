/** Launch-tail sprays, rocket flame, rising blossoms and climb crackle share the launch path. */
import type { Design, Launch } from '../schema/index';
import { mix, rgb, WHITE, type Vec3 } from './colour';
import { unit } from './directions';
import { launchPos, type ShotPlacement } from './launch';
import { launchTailColour } from './launch-colour';
import { LAUNCH_STYLES, type LaunchStyle } from './launch-styles';
import type { ParticleWriter } from './particles';
import { hash } from './random';
import { sourceSpray } from './spray-source';
import { launchSmoke } from './smoke';

// Prototype blossom quadratic fall coefficient, in m/s² (half the acceleration).
const BLOSSOM_FALL_M_S2 = 1;
// Prototype visual tuning: climb crackle rgb (linear RGB).
// Prototype crackle tint channel intensities, linear RGB.
const CRACKLE_GREEN = 0.85;
const CRACKLE_BLUE = 0.55;
const CLIMB_CRACKLE_RGB: Vec3 = [1, CRACKLE_GREEN, CRACKLE_BLUE];
// Prototype deterministic seed partition: launch seed scale (dimensionless seed multiplier).
const LAUNCH_SEED_SCALE = 7;
// Prototype deterministic seed partition: launch seed offset (dimensionless seed offset).
const LAUNCH_SEED_OFFSET = 1;
// Prototype fraction of dropped crackle pellets skipped, dimensionless probability.
const CLIMB_CRACKLE_SKIP_PROBABILITY = 0.3;
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

/** Appends launch sprays and embellishments at local seconds from firing.
 * The validated design supplies the burst palette; runtime.launch supplies source tuning.
 * seed is dimensionless; runtime.placement is horizontal metres plus muzzle metres.
 * Mutates writer; does not mutate the design or runtime controls. */
export function fillLaunchSpray(
  writer: ParticleWriter,
  design: Design,
  seed: number,
  runtime: { launch: Launch; local: number; placement: ShotPlacement },
): void {
  const { launch, local, placement } = runtime;
  const style = LAUNCH_STYLES[launch.tail];
  const climbTimeS = launch.time_s;
  const first = design.breaks[0]?.layers[0]?.colour.stops[0]?.[1];
  const palette = typeof first === 'string' ? [first] : first;
  const star = rgb(palette?.[0] ?? '#ffe2a8');
  const tailColour = launchTailColour(style, star);
  const path = (time: number): Vec3 => launchPos(launch, seed, time, placement);
  sourceSpray(
    writer,
    path,
    0,
    climbTimeS,
    local,
    {
      count: Math.round(launch.sparks * style.sparks),
      life: style.life * LAUNCH_LIFE_FACTOR,
      spread: launch.spread * style.spread,
      gravity: style.gravity,
      drag: style.drag ?? LAUNCH_DRAG_PER_S,
      size: LAUNCH_SIZE_FACTOR * style.size,
      flicker: style.flicker,
      glitter: style.glitter,
      glitterDelay: style.glitterDelay,
      fork: style.fork,
      colour: tailColour,
      seed: seed * LAUNCH_SEED_SCALE + LAUNCH_SEED_OFFSET,
      inherit: style.inherit ?? LAUNCH_INHERIT,
      cluster: LAUNCH_CLUSTER,
    },
    () => ({ kind: 'launch', launch, seed, placement }),
  );
  const context = { style, climbTimeS, local, path, seed, palette };
  fillMotorFlame(writer, context);
  fillClimbBlossoms(writer, context);
  fillClimbCrackle(writer, context);
  const [positionX, positionZ] = placement.position ?? [0, 0];
  launchSmoke(writer, launch, style, seed, positionX, positionZ, local, path);
}

interface LaunchSprayContext {
  style: LaunchStyle;
  climbTimeS: number;
  local: number;
  path: (time: number) => Vec3;
  seed: number;
  palette: string[] | undefined;
}
function fillMotorFlame(writer: ParticleWriter, context: LaunchSprayContext): void {
  const { style, climbTimeS, local, path } = context;
  if (writer.launchEffects && style.flame === true && local < climbTimeS) {
    const flameColour = rgb('#ffd38a');
    for (let sampleIndex = 0; sampleIndex < FLAME_SAMPLES; sampleIndex++) {
      const sourceTimeS = local - sampleIndex * FLAME_INTERVAL_S;
      if (sourceTimeS < 0) break;
      const sourcePosition = path(sourceTimeS);
      writer.spark(
        [sourcePosition[0], sourcePosition[1], sourcePosition[2]],
        mix(WHITE, flameColour, sampleIndex / FLAME_SAMPLES),
        FLAME_SIZE * (1 - sampleIndex / FLAME_SIZE_DECAY_SAMPLES),
        FLAME_ALPHA * (1 - sampleIndex / FLAME_SAMPLES),
      );
    }
  }
}
function fillClimbBlossoms(writer: ParticleWriter, context: LaunchSprayContext): void {
  const { style, climbTimeS, local, path, seed, palette } = context;
  if (!writer.launchEffects || style.blossoms === undefined) return;

  const blossoms = style.blossoms;
  const colours = blossomPalette(blossoms, palette);
  for (let slotIndex = 0; slotIndex < blossoms.count; slotIndex++) {
    const emissionTimeS =
      climbTimeS *
      (BLOSSOM_START +
        (BLOSSOM_WINDOW *
          (slotIndex + BLOSSOM_JITTER * hash(slotIndex, seed, BLOSSOM_TIME_STREAM))) /
          blossoms.count);
    const blossomAgeS = local - emissionTimeS;
    if (blossomAgeS < 0 || blossomAgeS > blossoms.life) continue;
    const blossomPosition = path(emissionTimeS);
    if (blossomAgeS < BLOSSOM_FLASH_S)
      writer.glow(
        [blossomPosition[0], blossomPosition[1], blossomPosition[2]],
        WHITE,
        BLOSSOM_FLASH_SIZE,
        BLOSSOM_FLASH_ALPHA * (1 - blossomAgeS / BLOSSOM_FLASH_S),
      );
    const reachM = blossoms.radius * (1 - Math.exp(-BLOSSOM_EXPANSION_PER_S * blossomAgeS));
    const alpha = Math.pow(1 - blossomAgeS / blossoms.life, BLOSSOM_FADE_POWER);
    const blossomColour = colours[slotIndex % colours.length];
    if (blossomColour === undefined) throw new RangeError('Blossom palette has no colour');
    const colour = mix(WHITE, blossomColour, Math.min(1, blossomAgeS * BLOSSOM_COLOUR_PER_S));
    for (let starIndex = 0; starIndex < BLOSSOM_STARS; starIndex++) {
      const direction = unit(
        slotIndex * BLOSSOM_KEY_STRIDE + starIndex,
        seed + BLOSSOM_SEED_OFFSET,
      );
      writer.spark(
        [
          blossomPosition[0] + direction[0] * reachM,
          blossomPosition[1] +
            direction[1] * reachM -
            BLOSSOM_FALL_M_S2 * blossomAgeS * blossomAgeS,
          blossomPosition[2] + direction[2] * reachM,
        ],
        colour,
        BLOSSOM_STAR_SIZE,
        BLOSSOM_STAR_ALPHA * alpha,
      );
    }
  }
}
function fillClimbCrackle(writer: ParticleWriter, context: LaunchSprayContext): void {
  const { style, climbTimeS, local, path, seed } = context;
  if (writer.launchEffects && style.crackle === true) {
    // Pellets dropped along the climb, each going off once with a sharp pop.
    for (let slotIndex = 0; slotIndex < climbTimeS / CLIMB_CRACKLE_INTERVAL_S; slotIndex++) {
      const emissionTimeS =
        slotIndex * CLIMB_CRACKLE_INTERVAL_S +
        hash(slotIndex, seed, CLIMB_CRACKLE_TIME_STREAM) * CLIMB_CRACKLE_INTERVAL_S;
      if (
        emissionTimeS > local ||
        hash(slotIndex, seed, CLIMB_CRACKLE_SKIP_STREAM) < CLIMB_CRACKLE_SKIP_PROBABILITY
      )
        continue;
      const popTimeS =
        emissionTimeS +
        CLIMB_CRACKLE_DELAY_S +
        CLIMB_CRACKLE_DELAY_RANGE_S * hash(slotIndex, seed, CLIMB_CRACKLE_DELAY_STREAM);
      const age = local - popTimeS;
      if (age < 0 || age > CLIMB_CRACKLE_LIFE_S) continue;
      const sourcePosition = path(emissionTimeS);
      const fade = 1 - age / CLIMB_CRACKLE_LIFE_S;
      writer.spark(
        [
          sourcePosition[0] +
            (hash(slotIndex, seed, CLIMB_CRACKLE_X_STREAM) - 0.5) * CLIMB_CRACKLE_REACH_M,
          sourcePosition[1] -
            CLIMB_CRACKLE_DROP_M -
            hash(slotIndex, seed, CLIMB_CRACKLE_Y_STREAM) * CLIMB_CRACKLE_REACH_M -
            CLIMB_CRACKLE_FALL_M_S * (popTimeS - emissionTimeS),
          sourcePosition[2] +
            (hash(slotIndex, seed, CLIMB_CRACKLE_Z_STREAM) - 0.5) * CLIMB_CRACKLE_REACH_M,
        ],
        CLIMB_CRACKLE_RGB,
        CLIMB_CRACKLE_SIZE,
        CLIMB_CRACKLE_ALPHA * fade * fade,
      );
    }
  }
}

function blossomPalette(
  blossoms: NonNullable<LaunchStyle['blossoms']>,
  palette: string[] | undefined,
): Vec3[] {
  return (blossoms.colours ?? palette ?? ['#ff3048']).map(rgb);
}
