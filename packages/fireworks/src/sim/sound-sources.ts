/** Authored acoustic cue selection, retaining the prototype's kind and layer timing. */
import type { Design, Layer } from '../schema/index';
import { LAUNCH_STYLES } from './launch-styles';
import type { Vec3 } from './colour';
import type { SoundEvent, SoundKind } from './events';
// Prototype acoustic tuning: reference burst radius in metres and heavy crackle threshold in pops.
const REFERENCE_RADIUS_M = 26;
const HEAVY_POP_COUNT = 14;
// Prototype hiss ignition after a burst, in seconds; glitter threshold is a fraction.
const HISS_DELAY_S = 0.3;
const GLITTER_THRESHOLD = 0.5;
// Prototype mine hiss duration and source elevations, in seconds and metres.
const MINE_HISS_S = 1.2;
const MINE_HISS_M = 10;
const MINE_CRACKLE_M = 20;
// Prototype ground sound positions, in metres, and wheel whistle duration, in seconds.
const FOUNTAIN_SOUND_M = 3;
const TOURBILLON_SOUND_M = 20;
const MAX_WHEEL_WHISTLE_S = 3;
// Prototype comet lift grouping and terminal split size, dimensionless.
const QUIET_COMET_COUNT = 3;
const COMET_SPLIT_SIZE = 0.35;
// Prototype fallback timing for unordered comet sources, in seconds.
const COMET_STAGGER_S = 0.1;
// Prototype mortar acoustic source elevation, in metres, independent of the visual tube muzzle.
const LIFT_SOUND_M = 1;
// Prototype wheel/spinner acoustic source elevation, in metres.
const ROTATING_SOUND_M = 2;
function cue(kind: SoundKind, time_s: number, position: Vec3): SoundEvent {
  return {
    kind,
    time_s,
    position,
    distance_m: 0,
    seed: 0,
    duration_s: 0,
    size: 1,
    quiet: false,
    heavy: false,
    loud: false,
    soft: false,
  };
}
function layerSounds(layer: Layer, at: number, position: Vec3): SoundEvent[] {
  const events: SoundEvent[] = [];
  for (const modifier of layer.modifiers) {
    if (modifier.kind === 'crackle' || modifier.kind === 'pop') {
      const offset = modifier.kind === 'pop' ? layer.life_s : layer.life_s * modifier.at;
      events.push({
        ...cue('crackle', at + offset, position),
        heavy: modifier.kind === 'crackle' && modifier.count >= HEAVY_POP_COUNT,
      });
    }
  }
  if (
    layer.trail.glitter > GLITTER_THRESHOLD ||
    layer.modifiers.some((modifier) => modifier.kind === 'strobe')
  ) {
    events.push({
      ...cue('hiss', at + HISS_DELAY_S, position),
      duration_s: layer.life_s,
    });
  }
  return events;
}
/** Returns firing-relative shell, rocket or mine cues in seconds and metres without mutation. */
export function shellSoundEvents(design: Extract<Design, { ground: null }>): SoundEvent[] {
  if (design.kind === 'mine') {
    const events = [
      cue('lift', 0, [0, LIFT_SOUND_M, 0]),
      { ...cue('hiss', 0, [0, MINE_HISS_M, 0]), duration_s: MINE_HISS_S },
    ];
    if (
      design.breaks.some((burst) =>
        burst.layers.some((layer) =>
          layer.modifiers.some((modifier) => modifier.kind === 'crackle'),
        ),
      )
    ) {
      events.push(cue('crackle', MINE_HISS_S, [0, MINE_CRACKLE_M, 0]));
    }
    return events;
  }
  const launch = design.launch;
  const whistle = LAUNCH_STYLES[launch.tail].whistle === true;
  const events = [
    cue('lift', 0, [0, LIFT_SOUND_M, 0]),
    {
      ...cue(whistle ? 'whistle' : 'whoosh', 0, [0, launch.height_m / 2, 0]),
      duration_s: launch.time_s,
    },
  ];
  for (const burst of design.breaks) {
    const seen = new Set<number>();
    for (const layer of burst.layers) {
      const at = launch.time_s + burst.at_s + layer.delay_s;
      const position: Vec3 = [layer.offset_m[0], launch.height_m + layer.offset_m[1], 0];
      if (!seen.has(layer.delay_s)) {
        seen.add(layer.delay_s);
        events.push({
          ...cue('boom', at, position),
          size: (burst.core.flash * layer.radius_m) / REFERENCE_RADIUS_M,
        });
      }
      events.push(...layerSounds(layer, at, position));
    }
  }
  return events;
}
function cometEvents(design: Extract<Design, { kind: 'comet' | 'candle' }>): SoundEvent[] {
  const comets = design.ground.comets;
  const count = comets.pattern === 'straight' ? 1 : comets.count;
  const events: SoundEvent[] = [];
  for (let index = 0; index < count; index++) {
    let at = index * COMET_STAGGER_S;
    if (comets.pattern === 'sequence' || comets.pattern === 'sweep') at = index * comets.gap_s;
    if (comets.pattern === 'fan') at = 0;
    events.push({
      ...cue('lift', at, [0, LIFT_SOUND_M, 0]),
      quiet: count > QUIET_COMET_COUNT,
    });
    if (comets.spin_rad_s !== 0 || comets.whistle) {
      events.push({
        ...cue('whistle', at, [0, comets.height_m / 2, 0]),
        duration_s: comets.time_s,
      });
    }
    if (comets.pop) events.push(cue('crackle', at + comets.time_s, [0, comets.height_m, 0]));
    if (comets.split !== null)
      events.push({
        ...cue('boom', at + comets.time_s, [0, comets.height_m, 0]),
        size: COMET_SPLIT_SIZE,
      });
  }
  events.push({
    ...cue('whoosh', 0, [0, comets.height_m / 2, 0]),
    duration_s: comets.time_s,
  });
  return events;
}
/** Returns firing-relative ground cues; candles reuse the prototype comet family. */
export function groundSoundEvents(design: Exclude<Design, { ground: null }>): SoundEvent[] {
  switch (design.kind) {
    case 'comet':
    case 'candle':
      return cometEvents(design);
    case 'fountain':
      return [
        {
          ...cue('hiss', 0, [0, FOUNTAIN_SOUND_M, 0]),
          duration_s: design.ground.fountain.duration_s,
          loud: true,
        },
      ];
    case 'tourbillon':
      return [
        {
          ...cue('whistle', 0, [0, TOURBILLON_SOUND_M, 0]),
          duration_s: design.ground.tourbillon.time_s,
        },
      ];
    case 'wheel':
    case 'spinner': {
      const duration =
        design.kind === 'wheel' ? design.ground.wheel.duration_s : design.ground.spinner.duration_s;
      return [
        {
          ...cue('hiss', 0, [0, ROTATING_SOUND_M, 0]),
          duration_s: duration,
          loud: true,
        },
        {
          ...cue('whistle', HISS_DELAY_S, [0, ROTATING_SOUND_M, 0]),
          duration_s: Math.min(MAX_WHEEL_WHISTLE_S, duration),
          soft: true,
        },
      ];
    }
  }
}
