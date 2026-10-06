/** Stateless simulation entry point for launches, shell breaks and ground effects. */
import type { SimulationOptions } from './simulation-options';
export type { SimulationOptions } from './simulation-options';
import { aimMineDirection } from './aim';
import { prototypeOr } from './numeric';
import { resolveDesign, type Design, type Fade } from '../schema/index';
import { brightnessAt, colourAt, rgb, type Vec3 } from './colour';
import { fillCore } from './core';
import { directions } from './directions';
import { starAppearance } from './fade';
import { fillStarTrail } from './shell-trail';
import { MUZZLE_M, launchPos } from './launch';
import { launchTailColour } from './launch-colour';
import { LAUNCH_STYLES } from './launch-styles';
import { fillGround } from './kinds/ground';
import { fillModifierEvents, parentEnd, type ModifierEventState } from './modifiers';
import { fillLaunchSpray } from './launch-spray';
import { burstSmoke, SMOKE_RGB } from './smoke';
import { starPos } from './motion';
import { ParticleWriter, type Particles } from './particles';

// Prototype deterministic seed partition: layer direction seed scale (dimensionless seed multiplier).
const LAYER_DIRECTION_SEED_SCALE = 13;
// Prototype deterministic seed partition: flare smoke seed step (dimensionless seed offset).
const FLARE_SMOKE_SEED_STEP = 0.7;
// Prototype visual tuning: mine flash size range (renderer size).
const MINE_FLASH_SIZE_RANGE = 6;
// Prototype visual tuning: mine flash size min (renderer size).
const MINE_FLASH_SIZE_MIN = 2;
// Prototype visual tuning: mine flash alpha (opacity).
const MINE_FLASH_ALPHA = 0.45;
// Prototype visual tuning: launch strobe power (dimensionless exponent).
const LAUNCH_STROBE_POWER = 6;
// Prototype visual tuning: launch strobe min (opacity multiplier).
const LAUNCH_STROBE_MIN = 0.04;
// Prototype visual tuning: launch strobe peak (opacity multiplier).
const LAUNCH_STROBE_PEAK = 1.6;
// Prototype visual tuning: flare smoke alpha (opacity multiplier).
const FLARE_SMOKE_ALPHA = 0.04;
// Prototype visual tuning: launch head size factor (size multiplier).
const LAUNCH_HEAD_SIZE_FACTOR = 1.9;
// Prototype visual tuning: launch glow size factor (size multiplier).
const LAUNCH_GLOW_SIZE_FACTOR = 2.2;
// Prototype visual tuning: glow alpha factor (opacity multiplier).
const GLOW_ALPHA_FACTOR = 0.12;
// Prototype visual tuning: strobe glow size factor (size multiplier).
const STROBE_GLOW_SIZE_FACTOR = 1.4;
// Prototype visual tuning: strobe point size factor (size multiplier).
const STROBE_POINT_SIZE_FACTOR = 0.9;
// Prototype visual tuning: star head size factor (size multiplier).
const STAR_HEAD_SIZE_FACTOR = 1.7;
// Prototype visual tuning: star size min (size multiplier).
const STAR_SIZE_MIN = 0.8;
// Prototype visual tuning: star size range (size multiplier).
const STAR_SIZE_RANGE = 0.4;
// Prototype visual tuning: flare smoke lift m (metres).
const FLARE_SMOKE_LIFT_M = 1.2;
// Prototype visual tuning: flare glow alpha (opacity multiplier).
const FLARE_GLOW_ALPHA = 0.08;
// Prototype visual tuning: flare glow size (renderer size).
const FLARE_GLOW_SIZE = 2.5;
// Prototype visual tuning: flare size threshold (renderer size).
const FLARE_SIZE_THRESHOLD = 2.4;
// Prototype visual tuning: star burn shrink (size multiplier).
const STAR_BURN_SHRINK = 0.65;
// Prototype visual tuning: half turn deg (degrees, angle conversion).
const HALF_TURN_DEG = 180;
// Prototype deterministic seed partition: launch strobe seed phase (cycles per seed).
const LAUNCH_STROBE_SEED_PHASE = 0.37;
// Prototype visual tuning: mine flash s (seconds).
const MINE_FLASH_S = 0.2;

/**
 * Simulates fresh particle arrays for a design at a firing-relative time.
 * @param design - Validated design with stored units.
 * @param time_s - Seconds from firing.
 * @param options - Optional seed, horizontal metres and muzzle height in metres.
 * @returns Tightly sized particle attributes for the requested instant.
 */
export function simulate(
  design: Design,
  time_s: number,
  options: SimulationOptions = {},
): Particles {
  design = resolveDesign(design);
  if (!Number.isFinite(time_s)) throw new RangeError('Simulation time must be finite');
  const writer = new ParticleWriter(
    options.sprays,
    options.smoke,
    options.launchEffects,
    options.sprayBirth,
  );
  writer.sprayPhase = options.sprayPhase;
  writer.spraySource = options.spraySource;
  if (time_s < 0) return writer.finish();
  // Preserve the prototype's seed-zero fallback, including for a playback override.
  const seed = prototypeOr(options.seed ?? design.seed, 1);
  if (design.launch === null) {
    fillGround(writer, design, seed, { time: time_s, placement: options });
    return writer.finish();
  }
  const launch = design.launch;
  const apexTimeS = design.kind === 'mine' ? 0 : launch.time_s;
  const mine = design.kind === 'mine';
  if (mine) fillMineFlash(writer, time_s, options);

  if (!mine) fillLaunchSpray(writer, design, seed, { launch, local: time_s, placement: options });
  if (time_s < apexTimeS) {
    fillLaunchHead(writer, design, seed, { time_s, options });
    return writer.finish();
  }

  fillBreaks(writer, design, seed, { time_s, options });
  return writer.finish();
}

interface ShellRuntime {
  time_s: number;
  options: SimulationOptions;
}
function fillLaunchHead(
  writer: ParticleWriter,
  design: Extract<Design, { launch: object }>,
  seed: number,
  runtime: ShellRuntime,
): void {
  const { time_s, options } = runtime;
  const launch = design.launch;

  const style = LAUNCH_STYLES[launch.tail];
  const first = design.breaks[0]?.layers[0];
  const star = first ? colourAt(first.colour, 0, 0, 0) : rgb('#ffe2a8');
  const tail = launchTailColour(style, star);
  let alpha = style.headAlpha;
  if (style.strobe !== undefined && style.strobe !== 0) {
    const strobePhase = time_s * style.strobe + seed * LAUNCH_STROBE_SEED_PHASE;
    alpha *=
      LAUNCH_STROBE_MIN +
      LAUNCH_STROBE_PEAK *
        Math.pow(1 - (strobePhase - Math.floor(strobePhase)), LAUNCH_STROBE_POWER);
  }
  const position = launchPos(launch, seed, time_s, options);
  writer.head(
    position,
    style.star === true ? tail : rgb('#ffe2a8'),
    LAUNCH_HEAD_SIZE_FACTOR * style.head,
    alpha,
  );
  writer.glow(
    position,
    rgb('#ffb866'),
    LAUNCH_GLOW_SIZE_FACTOR * style.head,
    GLOW_ALPHA_FACTOR * alpha,
  );
}

function fillBreaks(
  writer: ParticleWriter,
  design: Extract<Design, { launch: object }>,
  seed: number,
  runtime: ShellRuntime,
): void {
  const { time_s, options } = runtime;
  const launch = design.launch;
  const mine = design.kind === 'mine';
  const apexTimeS = mine ? 0 : launch.time_s;
  const [positionX, positionZ] = options.position ?? [0, 0];
  const burstX =
    positionX +
    (mine ? 0 : Math.tan((launch.tilt_deg * Math.PI) / HALF_TURN_DEG) * launch.height_m);
  const burstZ = positionZ + burstForwardOffset(design, options);
  // Random indices are global across breaks, matching the prototype's flattened layer list.
  let layerIndex = 0;
  for (const burst of design.breaks)
    for (const layer of burst.layers) {
      const index = layerIndex++;
      const age = time_s - apexTimeS - burst.at_s - layer.delay_s;
      if (layer.hidden || age < 0) continue;
      const centre: Vec3 = [
        burstX + layer.offset_m[0],
        burstHeight(design, options) + layer.offset_m[1],
        burstZ + layer.offset_m[2],
      ];
      if (!mine) {
        burstSmoke(writer, layer, seed, index, age, centre, launch.smoke);
        fillCore(writer, burst.core, layer, seed, index, age, centre);
      }
      const state: ShellLayerState = {
        layer,
        fade: burst.fade,
        direction: { x: 0, y: 0, z: 0, h: 0, h2: 0, ph: 0 },
        index: 0,
        seed,
        age,
        life: 0,
        centre,
        appearance: {
          base: [0, 0, 0],
          colour: [0, 0, 0],
          alpha: 0,
          grow: 1,
          flare: 1,
          strobing: false,
        },
        mine,
        placement: { ...options, pan_deg: options.pan_deg ?? launch.tilt_deg },
        layerIndex: index,
      };
      fillStars(writer, state);
    }
}

interface ShellLayerState extends ModifierEventState {
  fade: Fade;
  appearance: ReturnType<typeof starAppearance>;
  mine: boolean;
  placement: SimulationOptions;
  layerIndex: number;
}
function fillStars(writer: ParticleWriter, state: ShellLayerState): void {
  const { layer, mine, seed, age, fade } = state;
  const index = state.layerIndex;
  const starDirections = directions(
    layer.count,
    mine ? 'cone' : layer.pattern,
    seed * LAYER_DIRECTION_SEED_SCALE + index,
    layer.tilt,
  ).map((direction) => (mine ? aimMineDirection(direction, state.placement) : direction));
  starDirections.forEach((direction, starIndex) => {
    const life = layer.life_s * (1 - layer.life_var / 2 + layer.life_var * direction.h2);
    const appearance = starAppearance(layer, fade, direction, starIndex, age, life, seed);
    state.direction = direction;
    state.index = starIndex;
    state.life = life;
    state.appearance = appearance;
    fillStarTrail(writer, state);
    // Events may outlive the parent and do not depend on head visibility.
    if (age >= parentEnd(layer, life) || !layer.head.visible) {
      fillModifierEvents(writer, state);
      return;
    }
    fillStarHead(writer, state);
    fillModifierEvents(writer, state);
  });
}
function fillStarHead(writer: ParticleWriter, state: ShellLayerState): void {
  const { layer, direction, seed, age, life } = state;
  const appearance = state.appearance;
  const starIndex = state.index;
  const centre = state.centre;
  const progress = age / life;
  const vary = STAR_SIZE_MIN + STAR_SIZE_RANGE * direction.h;
  const burn = 1 - STAR_BURN_SHRINK * progress * progress;
  const position = starPos(layer, direction, age, centre);
  if (appearance.strobing) {
    const alpha = appearance.alpha * brightnessAt(layer.brightness, progress) * vary;
    writer.spark(
      position,
      appearance.colour,
      STROBE_POINT_SIZE_FACTOR * layer.head.size * appearance.flare,
      alpha,
    );
    writer.glow(
      position,
      appearance.colour,
      STROBE_GLOW_SIZE_FACTOR * layer.head.size * appearance.flare,
      GLOW_ALPHA_FACTOR * alpha,
    );
  } else
    writer.head(
      position,
      appearance.colour,
      STAR_HEAD_SIZE_FACTOR * layer.head.size * vary * burn * appearance.grow * appearance.flare,
      appearance.alpha * brightnessAt(layer.brightness, age / life) * vary,
      layer.head.halo ?? (layer.modifiers.some((m) => m.kind === 'strobe') ? 0 : 1),
    );
  if (layer.head.size > FLARE_SIZE_THRESHOLD) {
    writer.glow(position, appearance.colour, FLARE_GLOW_SIZE, FLARE_GLOW_ALPHA * appearance.alpha);
    writer.smoke(
      position[0],
      position[1] + FLARE_SMOKE_LIFT_M,
      position[2],
      SMOKE_RGB,
      1,
      FLARE_SMOKE_ALPHA * appearance.alpha,
      seed + starIndex * FLARE_SMOKE_SEED_STEP,
      age,
    );
  }
}

function fillMineFlash(writer: ParticleWriter, time_s: number, options: SimulationOptions): void {
  if (time_s >= MINE_FLASH_S) return;

  const [positionX, positionZ] = options.position ?? [0, 0];
  writer.glow(
    [positionX, options.muzzle_m ?? MUZZLE_M, positionZ],
    rgb('#ffd9a8'),
    MINE_FLASH_SIZE_RANGE * (1 - time_s / MINE_FLASH_S) + MINE_FLASH_SIZE_MIN,
    MINE_FLASH_ALPHA * (1 - time_s / MINE_FLASH_S),
  );
}

function burstHeight(
  design: Extract<Design, { launch: object }>,
  options: SimulationOptions,
): number {
  if (design.kind === 'mine') return options.muzzle_m ?? MUZZLE_M;
  return design.launch.height_m;
}

function burstForwardOffset(
  design: Extract<Design, { launch: object }>,
  placement: SimulationOptions,
): number {
  return design.kind === 'mine'
    ? 0
    : Math.tan(((placement.tilt_deg ?? 0) * Math.PI) / HALF_TURN_DEG) * design.launch.height_m;
}
