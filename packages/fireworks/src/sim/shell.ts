/** Stateless simulation entry point for launches, shell breaks and ground effects. */
import { resolveDesign, type Design } from '../schema/index';
import { brightnessAt, colourAt, mix, rgb, type Vec3 } from './colour';
import { fillCore } from './core';
import { directions } from './directions';
import { fadeAlpha, starAppearance } from './fade';
import { MUZZLE_M, launchPos, type ShotPlacement } from './launch';
import { LAUNCH_STYLES } from './launch-styles';
import { fillGround } from './kinds/ground';
import { fillModifierEvents, parentEnd, trailControls } from './modifiers';
import { fillLaunchSpray } from './launch-spray';
import { burstSmoke, SMOKE_RGB } from './smoke';
import { spray, TRAIL_DENSITY, TRAIL_LIFE } from './spray';
import { starPos } from './motion';
import { ParticleWriter, type Particles } from './particles';

// Prototype deterministic seed partition: layer direction seed scale (dimensionless seed multiplier).
const LAYER_DIRECTION_SEED_SCALE = 13;
// Prototype deterministic seed partition: trail seed scale (dimensionless seed multiplier).
const TRAIL_SEED_SCALE = 1009;
// Prototype deterministic seed partition: trail layer seed step (dimensionless seed offset).
const TRAIL_LAYER_SEED_STEP = 131;
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
// Prototype visual tuning: strobe trail alpha (opacity).
const STROBE_TRAIL_ALPHA = 0.25;
// Prototype visual tuning: trail end life (life fraction).
const TRAIL_END_LIFE = 0.92;
// Prototype visual tuning: trail start s (seconds).
const TRAIL_START_S = 0.02;
// Prototype visual tuning: half turn deg (degrees, angle conversion).
const HALF_TURN_DEG = 180;
// Prototype deterministic seed partition: launch strobe seed phase (cycles per seed).
const LAUNCH_STROBE_SEED_PHASE = 0.37;
// Prototype visual tuning: star tail mix (linear RGB fraction).
const STAR_TAIL_MIX = 0.3;
// Prototype visual tuning: mine flash s (seconds).
const MINE_FLASH_S = 0.2;

export interface SimulationOptions extends ShotPlacement {
  /** Optional deterministic seed override; zero retains the stored seed fallback. */
  seed?: number;
  /** Whether to emit CPU spray points; enabled by default. */
  sprays?: boolean;
  /** Whether to emit smoke attributes; enabled by default. */
  smoke?: boolean;
  /** Whether to emit flame, blossoms and climb crackle; enabled by default. */
  launchEffects?: boolean;
}

/**
 * Simulates fresh particle arrays for a design at a firing-relative time.
 * @param design Validated design with stored units.
 * @param time_s Seconds from firing.
 * @param options Optional seed, horizontal metres and muzzle height in metres.
 * @returns Tightly sized particle attributes for the requested instant.
 */
export function simulate(
  design: Design,
  time_s: number,
  options: SimulationOptions = {},
): Particles {
  design = resolveDesign(design);
  if (!Number.isFinite(time_s)) throw new RangeError('Simulation time must be finite');
  const writer = new ParticleWriter(options.sprays, options.smoke, options.launchEffects);
  if (time_s < 0) return writer.finish();
  // Preserve the prototype's seed-zero fallback, including for a playback override.
  const seed = (options.seed ?? design.seed) || 1;
  if (design.launch === null) {
    fillGround(writer, design, seed, time_s, options);
    return writer.finish();
  }
  const launch = design.launch,
    T = design.kind === 'mine' ? 0 : launch.time_s;
  const mine = design.kind === 'mine';
  if (mine && time_s < MINE_FLASH_S) {
    const [x, z] = options.position ?? [0, 0];
    writer.glow(
      [x, options.muzzle_m ?? MUZZLE_M, z],
      rgb('#ffd9a8'),
      MINE_FLASH_SIZE_RANGE * (1 - time_s / MINE_FLASH_S) + MINE_FLASH_SIZE_MIN,
      MINE_FLASH_ALPHA * (1 - time_s / MINE_FLASH_S),
    );
  }
  if (!mine) fillLaunchSpray(writer, design, launch, seed, time_s, options);
  if (time_s < T) {
    const st = LAUNCH_STYLES[launch.tail];
    const first = design.breaks[0]?.layers[0];
    const star = first ? colourAt(first.colour, 0, 0, 0) : rgb('#ffe2a8');
    const tail = st.colour
      ? rgb(st.colour)
      : st.star
        ? mix(rgb('#ffc070'), star, STAR_TAIL_MIX)
        : rgb('#ffe2a8');
    let alpha = st.headAlpha;
    if (st.strobe) {
      const x = time_s * st.strobe + seed * LAUNCH_STROBE_SEED_PHASE;
      alpha *=
        LAUNCH_STROBE_MIN +
        LAUNCH_STROBE_PEAK * Math.pow(1 - (x - Math.floor(x)), LAUNCH_STROBE_POWER);
    }
    const position = launchPos(launch, seed, time_s, options);
    writer.head(
      position,
      st.star ? tail : rgb('#ffe2a8'),
      LAUNCH_HEAD_SIZE_FACTOR * st.head,
      alpha,
    );
    writer.glow(
      position,
      rgb('#ffb866'),
      LAUNCH_GLOW_SIZE_FACTOR * st.head,
      GLOW_ALPHA_FACTOR * alpha,
    );
    return writer.finish();
  }
  const [px, pz] = options.position ?? [0, 0];
  const bx =
    px + (mine ? 0 : Math.tan((launch.tilt_deg * Math.PI) / HALF_TURN_DEG) * launch.height_m);
  // Random indices are global across breaks, matching the prototype's flattened layer list.
  let li = 0;
  for (const b of design.breaks)
    for (const layer of b.layers) {
      const index = li++;
      const age = time_s - T - b.at_s - layer.delay_s;
      if (layer.hidden || age < 0) continue;
      const centre: Vec3 = [
        bx + layer.offset_m[0],
        (mine ? (options.muzzle_m ?? MUZZLE_M) : launch.height_m) + layer.offset_m[1],
        pz + layer.offset_m[2],
      ];
      if (!mine) burstSmoke(writer, layer, seed, index, age, centre, launch.smoke);
      if (!mine) fillCore(writer, b.core, layer, seed, index, age, centre);
      const dirs = directions(
        layer.count,
        mine ? 'cone' : layer.pattern,
        seed * LAYER_DIRECTION_SEED_SCALE + index,
        layer.tilt,
      );
      dirs.forEach((q, i) => {
        const life = layer.life_s * (1 - layer.life_var / 2 + layer.life_var * q.h2);
        const a = starAppearance(layer, b.fade, q, i, age, life, seed);
        const controls = trailControls(layer);
        const strobe = layer.modifiers.some((m) => m.kind === 'strobe');
        const twinkle = layer.modifiers.some((m) => m.kind === 'twinkle');
        const tail =
          layer.trail.colour === 'star'
            ? a.base
            : rgb(layer.trail.colour === 'house' ? '#ffe2a8' : layer.trail.colour);
        spray(
          writer,
          (t) => starPos(layer, q, t, centre),
          TRAIL_START_S,
          Math.min(parentEnd(layer, life), life * TRAIL_END_LIFE),
          age,
          {
            count: Math.round(layer.trail.sparks * TRAIL_DENSITY),
            life: layer.trail.length_s * TRAIL_LIFE,
            spread: layer.trail.spread_m_s,
            gravity: layer.trail.gravity_m_s2,
            drag: layer.trail.drag_per_s,
            size: layer.trail.size,
            flicker: layer.trail.flicker,
            glitter: controls.glitter,
            glitterDelay: controls.glitter_delay_s,
            fork: layer.trail.fork,
            colour: tail,
            seed: seed * TRAIL_SEED_SCALE + index * TRAIL_LAYER_SEED_STEP + i,
            alphaAt: strobe || twinkle ? undefined : (t) => fadeAlpha(b.fade, t, life),
            alpha: strobe ? STROBE_TRAIL_ALPHA : 1,
            inherit: 0,
          },
        );
        // Events may outlive the parent and do not depend on head visibility.
        if (age >= parentEnd(layer, life) || !layer.head.visible) {
          fillModifierEvents(writer, layer, q, i, seed, age, life, centre, a);
          return;
        }
        const progress = age / life,
          vary = STAR_SIZE_MIN + STAR_SIZE_RANGE * q.h,
          burn = 1 - STAR_BURN_SHRINK * progress * progress;
        const position = starPos(layer, q, age, centre);
        if (a.strobing) {
          const alpha = a.alpha * brightnessAt(layer.brightness, progress) * vary;
          writer.spark(
            position,
            a.colour,
            STROBE_POINT_SIZE_FACTOR * layer.head.size * a.flare,
            alpha,
          );
          writer.glow(
            position,
            a.colour,
            STROBE_GLOW_SIZE_FACTOR * layer.head.size * a.flare,
            GLOW_ALPHA_FACTOR * alpha,
          );
        } else
          writer.head(
            position,
            a.colour,
            STAR_HEAD_SIZE_FACTOR * layer.head.size * vary * burn * a.grow * a.flare,
            a.alpha * brightnessAt(layer.brightness, age / life) * vary,
            layer.head.halo ?? (layer.modifiers.some((m) => m.kind === 'strobe') ? 0 : 1),
          );
        if (layer.head.size > FLARE_SIZE_THRESHOLD) {
          writer.glow(position, a.colour, FLARE_GLOW_SIZE, FLARE_GLOW_ALPHA * a.alpha);
          writer.smoke(
            position[0],
            position[1] + FLARE_SMOKE_LIFT_M,
            position[2],
            SMOKE_RGB,
            1,
            FLARE_SMOKE_ALPHA * a.alpha,
            seed + i * FLARE_SMOKE_SEED_STEP,
            age,
          );
        }
        fillModifierEvents(writer, layer, q, i, seed, age, life, centre, a);
      });
    }
  return writer.finish();
}
