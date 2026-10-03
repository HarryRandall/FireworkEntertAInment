/** Source-clock comets simulation, retaining prototype tuning and stream identities. */
import type { Design } from '../../schema/index';
import { colourAt, rgb, WHITE, type Vec3 } from '../colour';
import { MUZZLE_M } from '../launch';
import { crackle, crossette } from '../modifiers';
import { type ParticleWriter } from '../particles';
import { sourceSpray } from '../spray-source';
import { cometTrajectory } from '../ground-sources';
import { cometSmoke } from '../smoke';
import { hash } from '../random';

import type { GroundRuntime } from './ground';
// Prototype visual tuning: sideways paths reach their full offset once a particle is 6 m clear.
const CLEARANCE_HEIGHT_M = 6;
// Prototype comet pop flash opacity, dimensionless.
const COMET_POP_FLASH_ALPHA = 0.5;
// Prototype visual tuning: half turn deg (degrees, angle conversion).
const HALF_TURN_DEG = 180;
// Prototype visual tuning: comet flicker (opacity variation).
const COMET_FLICKER = 0.6;
// Prototype visual tuning: comet split gravity m s2 (m/s²).
const COMET_SPLIT_GRAVITY_M_S2 = 6;
// Prototype visual tuning: comet cluster (sparks per slot).
const COMET_CLUSTER = 5;
// Prototype deterministic seed partition: comet split seed scale (dimensionless seed multiplier).
const COMET_SPLIT_SEED_SCALE = 29;
// Prototype visual tuning: comet split size factor (size multiplier).
const COMET_SPLIT_SIZE_FACTOR = 1.6;
// Prototype visual tuning: comet velocity step s (seconds).
const COMET_VELOCITY_STEP_S = 0.02;
// Prototype visual tuning: comet pop key offset (dimensionless key offset).
const COMET_POP_KEY_OFFSET = 7;
// Prototype visual tuning: comet pop count (sparks).
const COMET_POP_COUNT = 30;
// Prototype visual tuning: comet pop flash size (renderer size).
// Prototype terminal pop flash duration, in seconds.
const COMET_POP_FLASH_SIZE = 3;
// Prototype visual tuning: comet head size factor (size multiplier).
const COMET_HEAD_SIZE_FACTOR = 1.9;
// Prototype visual tuning: comet inherit (velocity fraction).
const COMET_INHERIT = 0.05;
// Prototype visual tuning: comet spin inherit (velocity fraction).
const COMET_SPIN_INHERIT = 0.55;
// Prototype deterministic seed partition: comet seed scale (dimensionless seed multiplier).
const COMET_SEED_SCALE = 71;
// Prototype visual tuning: comet glitter flicker (opacity variation).
const COMET_GLITTER_FLICKER = 0.9;
// Prototype visual tuning: comet spray size factor (size multiplier).
const COMET_SPRAY_SIZE_FACTOR = 1.1;
// Prototype visual tuning: comet drag per s (1/s).
const COMET_DRAG_PER_S = 2.4;
// Prototype visual tuning: comet gravity m s2 (m/s²).
const COMET_GRAVITY_M_S2 = 4;
// Prototype visual tuning: comet spread m s (m/s).
const COMET_SPREAD_M_S = 0.8;
// Prototype visual tuning: comet spray tail s (seconds).
const COMET_SPRAY_TAIL_S = 1.4;
// Prototype visual tuning: comet height range (height multiplier).
const COMET_HEIGHT_RANGE = 0.3;
// Prototype visual tuning: comet height min (height multiplier).
const COMET_HEIGHT_MIN = 0.85;
// Prototype visual tuning: comet spin spread m s (m/s).
const COMET_SPIN_SPREAD_M_S = 1.4;
// Prototype visual tuning: comet pop reach m (metres).
const COMET_POP_REACH_M = 5;
// Prototype deterministic seed partition: comet split seed step (dimensionless seed offset).
const COMET_SPLIT_SEED_STEP = 5;
// Prototype visual tuning: comet split density divisor (dimensionless divisor).
const COMET_SPLIT_DENSITY_DIVISOR = 6;
// Prototype visual tuning: comet split trail life s (seconds).
const COMET_SPLIT_TRAIL_LIFE_S = 0.6;
// Prototype visual tuning: comet split trail spread m s (m/s).
const COMET_SPLIT_TRAIL_SPREAD_M_S = 0.6;
// Prototype visual tuning: staggered fan comets start 0.08 s farther from the centre.
const FAN_STAGGER_S = 0.08;
// Prototype random launch window, in seconds.
const RANDOM_START_WINDOW_S = 0.6;
// Prototype sweep grouping, in comet sources per row.
const SWEEP_ROW_SIZE = 5;
// Prototype head fade after climb, in seconds.
const COMET_HEAD_TAIL_S = 0.3;
// Prototype terminal pop visibility window, in seconds.
const COMET_POP_DURATION_S = 0.7;
// Prototype terminal pop flash duration, in seconds.
const COMET_POP_FLASH_S = 0.05;
// Prototype source phase separation, in radians.
const COMET_SPIN_PHASE_RAD = 1.7;
// Prototype random streams independently sample comet spread, yaw, start, height and colour (dimensionless selectors).
const COMET_ANGLE_STREAM = 21;
const COMET_YAW_STREAM = 23;
const COMET_START_STREAM = 22;
const COMET_HEIGHT_STREAM = 24;
const COMET_COLOUR_STREAM = 3;
const clear = (height: number) => Math.max(0, Math.min(1, height / CLEARANCE_HEIGHT_M));

/** Appends deterministic comets particles at runtime.time seconds from firing; mutates writer. */
export function fillComets(
  writer: ParticleWriter,
  design: Extract<Design, { kind: 'comet' | 'candle' }>,
  seed: number,
  runtime: GroundRuntime,
): void {
  const { time, placement } = runtime;
  const [positionX, positionZ] = placement.position ?? [0, 0];
  const muzzle = placement.muzzle_m ?? MUZZLE_M;

  const comets = design.ground.comets;
  const sourceCount = comets.pattern === 'straight' ? 1 : comets.count;
  // One workspace per effect; emitter helpers reuse it without per-particle allocation.
  const context: CometContext = {
    writer,
    comets,
    seed,
    sourceCount,
    positionX,
    positionZ,
    muzzle,
    time,
    sourceIndex: 0,
    age: 0,
    path: () => [0, 0, 0],
    tail: WHITE,
    angle: 0,
    yaw: 0,
    start: 0,
  };
  for (let sourceIndex = 0; sourceIndex < sourceCount; sourceIndex++) {
    context.sourceIndex = sourceIndex;
    fillCometSource(context);
  }
}

type Comets = Extract<Design, { kind: 'comet' | 'candle' }>['ground']['comets'];
interface CometContext {
  writer: ParticleWriter;
  comets: Comets;
  seed: number;
  sourceCount: number;
  positionX: number;
  positionZ: number;
  muzzle: number;
  time: number;
  sourceIndex: number;
  age: number;
  path: (time: number) => Vec3;
  tail: Vec3;
  angle: number;
  yaw: number;
  start: number;
}
function fillCometSource(context: CometContext): void {
  const { writer, comets, seed, positionX, positionZ, muzzle, time, sourceIndex } = context;

  selectCometSource(context);
  const { angle, yaw, start } = context;
  const age = time - start;
  context.age = age;
  if (age < 0 || age > comets.time_s + COMET_SPRAY_TAIL_S) return;
  const height = cometHeight(comets, sourceIndex, seed);
  const path = (sourceTime: number): Vec3 => {
    const u = Math.min(1, Math.max(0, sourceTime / comets.time_s));
    const dist = height * (1 - (1 - u) ** 2);
    const spin = comets.spin_rad_s !== 0 ? comets.spin_radius_m : 0;
    const a = sourceTime * comets.spin_rad_s + sourceIndex * COMET_SPIN_PHASE_RAD;
    const r = spin * clear(dist);
    return [
      positionX + Math.sin(angle) * dist + Math.cos(a) * r,
      muzzle + Math.cos(angle) * Math.cos(yaw) * dist,
      positionZ + Math.sin(yaw) * dist + Math.sin(a) * r,
    ];
  };
  const original = colourAt(
    comets.colour,
    0,
    sourceIndex,
    hash(sourceIndex, seed, COMET_COLOUR_STREAM),
  );
  const tail =
    comets.trail === 'star' ? original : rgb(comets.trail === 'house' ? '#ffe2a8' : comets.trail);
  sourceSpray(
    writer,
    path,
    0,
    comets.time_s,
    age,
    {
      count: comets.sparks,
      life: comets.tail_life_s,
      spread: comets.spin_rad_s !== 0 ? COMET_SPIN_SPREAD_M_S : COMET_SPREAD_M_S,
      gravity: COMET_GRAVITY_M_S2,
      drag: COMET_DRAG_PER_S,
      size: COMET_SPRAY_SIZE_FACTOR * comets.size,
      flicker: comets.glitter !== 0 ? COMET_GLITTER_FLICKER : COMET_FLICKER,
      glitter: comets.glitter,
      colour: tail,
      seed: seed * COMET_SEED_SCALE + sourceIndex,
      inherit: comets.spin_rad_s !== 0 ? COMET_SPIN_INHERIT : COMET_INHERIT,
      cluster: COMET_CLUSTER,
    },
    () =>
      cometTrajectory(comets, [positionX, muzzle, positionZ], { height, angle, yaw, sourceIndex }),
  );
  cometSmoke(writer, seed, sourceIndex, positionX, positionZ, age);
  context.path = path;
  context.tail = tail;
  fillCometHead(context);
  fillCometPop(context);
  fillCometSplit(context);
}
function fillCometHead(context: CometContext): void {
  const { writer, comets, seed, age, sourceIndex, path } = context;
  const head = colourAt(
    comets.colour,
    age / comets.time_s,
    sourceIndex,
    hash(sourceIndex, seed, COMET_COLOUR_STREAM),
  );
  if (age < comets.time_s + COMET_HEAD_TAIL_S)
    writer.head(
      path(age),
      head,
      COMET_HEAD_SIZE_FACTOR * comets.size,
      cometHeadAlpha(comets, age),
      comets.halo,
    );
}
function fillCometPop(context: CometContext): void {
  const { writer, comets, seed, age, sourceIndex, path } = context;
  if (comets.pop && age >= comets.time_s && age < comets.time_s + COMET_POP_DURATION_S) {
    const origin = path(comets.time_s);
    if (age - comets.time_s < COMET_POP_FLASH_S)
      writer.glow(
        origin,
        WHITE,
        COMET_POP_FLASH_SIZE,
        COMET_POP_FLASH_ALPHA * (1 - (age - comets.time_s) / COMET_POP_FLASH_S),
      );
    crackle(
      writer,
      origin,
      comets.time_s,
      age,
      COMET_POP_COUNT,
      sourceIndex + COMET_POP_KEY_OFFSET,
      seed,
      COMET_POP_REACH_M,
    );
  }
}
function fillCometSplit(context: CometContext): void {
  const { writer, comets, seed, age, sourceIndex, path, tail } = context;
  if (comets.split && age >= comets.time_s) {
    const origin = path(comets.time_s);
    const before = path(comets.time_s - COMET_VELOCITY_STEP_S);
    crossette(
      writer,
      origin,
      [origin[0] - before[0], origin[1] - before[1], origin[2] - before[2]],
      age - comets.time_s,
      comets.split.life_s,
      comets.split.count,
      comets.split.distance_m,
      COMET_SPLIT_GRAVITY_M_S2,
      colourAt(comets.colour, 0, sourceIndex, hash(sourceIndex, seed, COMET_COLOUR_STREAM)),
      COMET_SPLIT_SIZE_FACTOR * comets.size,
      {
        at: comets.time_s,
        now: age,
        colour: tail,
        seed: seed * COMET_SPLIT_SEED_SCALE + sourceIndex * COMET_SPLIT_SEED_STEP,
        trail: {
          sparks: comets.sparks / COMET_SPLIT_DENSITY_DIVISOR,
          length_s: COMET_SPLIT_TRAIL_LIFE_S,
          spread_m_s: COMET_SPLIT_TRAIL_SPREAD_M_S,
          size: comets.size,
          glitter: 0,
        },
      },
    );
  }
}

function cometHeadAlpha(comets: Comets, age: number): number {
  if (comets.pop || comets.split !== null) return 1;
  if (age > comets.time_s) return 1 - (age - comets.time_s) / COMET_HEAD_TAIL_S;
  return 1;
}

function selectCometSource(context: CometContext): void {
  const { comets, seed, sourceCount, sourceIndex } = context;
  context.angle = 0;
  context.yaw = 0;
  context.start = 0;
  const spread = (comets.spread_deg * Math.PI) / HALF_TURN_DEG;
  if (comets.pattern === 'fan' && sourceCount > 1) {
    context.angle = -spread / 2 + (spread * sourceIndex) / (sourceCount - 1);
    context.start = Math.abs(sourceIndex - (sourceCount - 1) / 2) * FAN_STAGGER_S;
  } else if (comets.pattern === 'random' || comets.pattern === 'sequence') {
    context.angle = (hash(sourceIndex, seed, COMET_ANGLE_STREAM) - 0.5) * spread;
    context.yaw =
      (hash(sourceIndex, seed, COMET_YAW_STREAM) - 0.5) *
      spread *
      (comets.pattern === 'sequence' ? 0.5 : 1);
    context.start =
      comets.pattern === 'sequence'
        ? sourceIndex * comets.gap_s
        : hash(sourceIndex, seed, COMET_START_STREAM) * RANDOM_START_WINDOW_S;
  } else if (comets.pattern === 'sweep') {
    const row = Math.floor(sourceIndex / SWEEP_ROW_SIZE);
    const j = sourceIndex % SWEEP_ROW_SIZE;
    context.angle =
      -spread / 2 + (spread * (row % 2 !== 0 ? SWEEP_ROW_SIZE - 1 - j : j)) / (SWEEP_ROW_SIZE - 1);
    context.start = sourceIndex * comets.gap_s;
  }
}

function cometHeight(comets: Comets, sourceIndex: number, seed: number): number {
  return (
    comets.height_m *
    (comets.pattern === 'sequence'
      ? COMET_HEIGHT_MIN + COMET_HEIGHT_RANGE * hash(sourceIndex, seed, COMET_HEIGHT_STREAM)
      : 1)
  );
}
