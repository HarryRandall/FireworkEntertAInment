/** Ordered layer-modifier composition and its independent child-particle events. */

import type { Layer, Modifier } from '../schema/index';
import { mix, WHITE, type Vec3 } from './colour';
import type { StarDirection } from './directions';
import { unit } from './directions';
import { starPos } from './motion';
import { type ParticleWriter } from './particles';
import { rgb } from './colour';

import { crackle, crossette } from './modifier-children';
export { crackle, crossette } from './modifier-children';
import { hash } from './random';

// Prototype deterministic seed partition: child seed scale (dimensionless seed multiplier).
const CHILD_SEED_SCALE = 17;
// Prototype deterministic seed partition: child star seed step (dimensionless seed offset).
const CHILD_STAR_SEED_STEP = 11;
// Prototype visual tuning: pop fade power (dimensionless exponent).
const POP_FADE_POWER = 1.5;
// Prototype visual tuning: pop size (renderer size).
const POP_SIZE = 0.75;
// Prototype visual tuning: continuous crackle reach m (metres).
const CONTINUOUS_CRACKLE_REACH_M = 1.2;
// Prototype deterministic seed partition: pop seed offset (dimensionless seed offset).
const POP_SEED_OFFSET = 41;
// Prototype deterministic seed partition: pop key stride (dimensionless key multiplier).
const POP_KEY_STRIDE = 64;
// Prototype visual tuning: pop colour per s (1/s).
const POP_COLOUR_PER_S = 5;
// Prototype visual tuning: crackle event window s (seconds).
const CRACKLE_EVENT_WINDOW_S = 0.6;
// Prototype visual tuning: pop reach m (metres).
const POP_REACH_M = 3.5;
// Prototype visual tuning: pop expansion per s (1/s).
const POP_EXPANSION_PER_S = 6;
// Prototype visual tuning: pop flash s (seconds).
const POP_FLASH_S = 0.05;
// Prototype visual tuning: pop flash alpha (opacity).
const POP_FLASH_ALPHA = 0.55;
// Prototype visual tuning: terminal crackle head s (seconds).
const TERMINAL_CRACKLE_HEAD_S = 0.45;
// Prototype visual tuning: child life fraction (life fraction).
const CHILD_LIFE_FRACTION = 0.4;
// Prototype visual tuning: terminal crackle reach m (metres).
const TERMINAL_CRACKLE_REACH_M = 4.5;
// Prototype visual tuning: terminal crackle window s (seconds).
const TERMINAL_CRACKLE_WINDOW_S = 0.7;
// Prototype deterministic seed partition: continuous crackle event key stride (dimensionless key multiplier).
const CONTINUOUS_CRACKLE_EVENT_KEY_STRIDE = 977;
// Prototype visual tuning: continuous crackle count (sparks).
const CONTINUOUS_CRACKLE_COUNT = 3;
// Prototype deterministic seed partition: continuous crackle key stride (dimensionless key multiplier).
const CONTINUOUS_CRACKLE_KEY_STRIDE = 53;
// Prototype visual tuning: continuous crackle jitter s (seconds).
const CONTINUOUS_CRACKLE_JITTER_S = 0.12;
// Prototype visual tuning: continuous crackle interval s (seconds).
const CONTINUOUS_CRACKLE_INTERVAL_S = 0.18;
// Prototype visual tuning: continuous crackle slots (events).
const CONTINUOUS_CRACKLE_SLOTS = 40;
// Prototype visual tuning: child burn shrink (size multiplier).
const CHILD_BURN_SHRINK = 0.65;
// Prototype visual tuning: child head size factor (size multiplier).
const CHILD_HEAD_SIZE_FACTOR = 1.7;
// Prototype visual tuning: child reach fraction (layer radius fraction).
const CHILD_REACH_FRACTION = 0.3;
// Prototype visual tuning: child life max s (seconds).
const CHILD_LIFE_MAX_S = 0.9;
// Prototype visual tuning: parent velocity step s (seconds).
const PARENT_VELOCITY_STEP_S = 0.02;
// Prototype visual tuning: pop fall m s2 (m/s², quadratic fall coefficient).
const POP_FALL_M_S2 = 1.2;
// Prototype visual tuning: terminal crackle head size factor (size multiplier).
const TERMINAL_CRACKLE_HEAD_SIZE_FACTOR = 1.2;
// Prototype visual tuning: terminal crackle head alpha (opacity multiplier).
const TERMINAL_CRACKLE_HEAD_ALPHA = 0.4;
// Prototype visual tuning: pop life s (seconds).
const POP_LIFE_S = 0.6;
// Prototype visual tuning: pop alpha (opacity multiplier).
const POP_ALPHA = 1.5;
// Prototype hash stream for event jitter, dimensionless.
const CONTINUOUS_CRACKLE_JITTER_STREAM = 26;

/** Composition order: twist, additive motion, ghost colour, burn fade, brightness
 * modifiers in stored order, parent termination, then independent child events.
 * Terminating effects use the earliest trigger; child events still run independently.
 * Glitter adjusts tail controls and whistle is retained as a sound control.
 */
/** Returns the parent-star end time in seconds after terminal modifiers. */
export function parentEnd(layer: Layer, life: number): number {
  return Math.min(
    life,
    ...layer.modifiers.map((modifier) =>
      modifier.kind === 'crossette' ||
      modifier.kind === 'split' ||
      (modifier.kind === 'crackle' && modifier.spread !== 'continuous')
        ? modifier.at * life
        : Infinity,
    ),
  );
}

// Child paths share the same closed-form motion for heads and trails.

/** Appends child events for a layer at its age in seconds. */
export function fillModifierEvents(writer: ParticleWriter, state: ModifierEventState): void {
  const { layer, age, life } = state;
  for (const modifier of layer.modifiers) {
    const at = modifier.at * life;
    if ((modifier.kind === 'crossette' || modifier.kind === 'split') && age >= at)
      fillSplitEvent(writer, state, modifier);
    else if (modifier.kind === 'crackle' && age >= at) fillCrackleEvent(writer, state, modifier);
    else if (modifier.kind === 'pop' && age >= life && age < life + POP_LIFE_S)
      fillPopEvent(writer, state, modifier);
  }
}
/** Reused layer workspace; ages and life are seconds from layer ignition, centre is world metres. */
export interface ModifierEventState {
  layer: Layer;
  direction: StarDirection;
  index: number;
  seed: number;
  age: number;
  life: number;
  centre: Vec3;
  appearance: { base: Vec3; colour: Vec3; alpha: number };
}

/** Returns the layer's clamped glitter intensity and delayed tail start in seconds. */
export function trailControls(layer: Layer): { glitter: number; glitter_delay_s: number } {
  let glitter = layer.trail.glitter;
  let glitter_delay_s = layer.trail.glitter_delay_s;
  for (const modifier of layer.modifiers)
    if (modifier.kind === 'glitter') {
      glitter = Math.max(0, Math.min(1, glitter + modifier.amount));
      glitter_delay_s = modifier.at * layer.life_s;
    }
  return { glitter, glitter_delay_s };
}

function fillSplitEvent(
  writer: ParticleWriter,
  state: ModifierEventState,
  modifier: Modifier,
): void {
  const { layer, direction, index, seed, age, life, centre, appearance } = state;
  const at = modifier.at * life;
  const base = appearance.base;

  const origin = starPos(layer, direction, at, centre);
  const next = starPos(layer, direction, at + PARENT_VELOCITY_STEP_S, centre);
  crossette(
    writer,
    origin,
    [next[0] - origin[0], next[1] - origin[1], next[2] - origin[2]],
    age - at,
    Math.min(CHILD_LIFE_MAX_S, life * CHILD_LIFE_FRACTION),
    modifier.count,
    layer.radius_m * CHILD_REACH_FRACTION,
    layer.gravity_m_s2,
    base,
    CHILD_HEAD_SIZE_FACTOR * layer.head.size * (1 - CHILD_BURN_SHRINK * modifier.at * modifier.at),
    {
      at,
      now: age,
      trail: layer.trail,
      colour:
        layer.trail.colour === 'star'
          ? base
          : rgb(layer.trail.colour === 'house' ? '#ffe2a8' : layer.trail.colour),
      seed: seed * CHILD_SEED_SCALE + index * CHILD_STAR_SEED_STEP,
    },
  );
}
function fillCrackleEvent(
  writer: ParticleWriter,
  state: ModifierEventState,
  modifier: Modifier,
): void {
  const { layer, direction, index, seed, age, life, centre, appearance } = state;
  const at = modifier.at * life;

  if (modifier.spread === 'continuous') {
    for (let slotIndex = 0; slotIndex < CONTINUOUS_CRACKLE_SLOTS; slotIndex++) {
      const birthTime =
        at +
        slotIndex * CONTINUOUS_CRACKLE_INTERVAL_S +
        CONTINUOUS_CRACKLE_JITTER_S *
          hash(
            index * CONTINUOUS_CRACKLE_KEY_STRIDE + slotIndex,
            seed,
            CONTINUOUS_CRACKLE_JITTER_STREAM,
          );
      if (birthTime > life || birthTime > age) break;
      if (age - birthTime > CRACKLE_EVENT_WINDOW_S) continue;
      crackle(
        writer,
        starPos(layer, direction, birthTime, centre),
        birthTime,
        age,
        CONTINUOUS_CRACKLE_COUNT,
        index * CONTINUOUS_CRACKLE_EVENT_KEY_STRIDE + slotIndex,
        seed,
        CONTINUOUS_CRACKLE_REACH_M,
      );
    }
  } else if (age < at + TERMINAL_CRACKLE_WINDOW_S) {
    crackle(
      writer,
      starPos(layer, direction, at, centre),
      at,
      age,
      modifier.count * 2,
      index,
      seed,
      TERMINAL_CRACKLE_REACH_M,
    );
    if (layer.head.visible && age < at + TERMINAL_CRACKLE_HEAD_S)
      writer.head(
        starPos(layer, direction, age, centre),
        appearance.colour,
        TERMINAL_CRACKLE_HEAD_SIZE_FACTOR * layer.head.size,
        TERMINAL_CRACKLE_HEAD_ALPHA * (1 - (age - at) / TERMINAL_CRACKLE_HEAD_S) * appearance.alpha,
        0,
      );
  }
}
function fillPopEvent(writer: ParticleWriter, state: ModifierEventState, modifier: Modifier): void {
  const { layer, direction, index, seed, age, life, centre, appearance } = state;

  const base = appearance.base;

  const popAge = age - life;
  const origin = starPos(layer, direction, life, centre);
  if (popAge < POP_FLASH_S)
    writer.glow(origin, WHITE, 2, POP_FLASH_ALPHA * (1 - popAge / POP_FLASH_S));
  const reachM = (1 - Math.exp(-POP_EXPANSION_PER_S * popAge)) * POP_REACH_M * modifier.amount;
  const slotIndex = Math.pow(1 - popAge / POP_LIFE_S, POP_FADE_POWER);
  const colour = mix(WHITE, base, Math.min(1, popAge * POP_COLOUR_PER_S));
  for (let c = 0; c < modifier.count; c++) {
    const u = unit(index * POP_KEY_STRIDE + c, seed + POP_SEED_OFFSET);
    writer.spark(
      [
        origin[0] + u[0] * reachM,
        origin[1] + u[1] * reachM - POP_FALL_M_S2 * popAge * popAge,
        origin[2] + u[2] * reachM,
      ],
      colour,
      POP_SIZE,
      POP_ALPHA * slotIndex,
    );
  }
}
