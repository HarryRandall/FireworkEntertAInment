/** Shell star spray controls, preserving the CPU callback and handing analytic paths to the GPU. */
import type { Fade } from '../schema/index';
import { rgb } from './colour';
import { fadeAlpha } from './fade';
import { parentEnd, trailControls, type ModifierEventState } from './modifiers';
import { starPos } from './motion';
import type { ParticleWriter } from './particles';
import { TRAIL_DENSITY, TRAIL_LIFE } from './spray';
import { sourceSpray } from './spray-source';
// Prototype deterministic seed partition: trail seed scale (dimensionless seed multiplier).
const TRAIL_SEED_SCALE = 1009;
// Prototype deterministic seed partition: trail layer seed step (dimensionless seed offset).
const TRAIL_LAYER_SEED_STEP = 131;
// Prototype visual tuning: strobe trail alpha (opacity).
const STROBE_TRAIL_ALPHA = 0.25;
// Prototype visual tuning: trail end life (life fraction).
const TRAIL_END_LIFE = 0.92;
// Prototype visual tuning: trail start s (seconds).
const TRAIL_START_S = 0.02;
/** Emits a star trail at burst-relative seconds with validated metre geometry; mutates writer only. */
export function fillStarTrail(
  writer: ParticleWriter,
  state: ModifierEventState & { layerIndex: number; fade: Fade },
): void {
  const { layer, direction, seed, age, centre, life, fade } = state;
  const index = state.layerIndex;
  const starIndex = state.index;
  const appearance = state.appearance;
  const controls = trailControls(layer);
  const strobe = layer.modifiers.some((m) => m.kind === 'strobe');
  const twinkle = layer.modifiers.some((m) => m.kind === 'twinkle');
  const tail =
    layer.trail.colour === 'star'
      ? appearance.base
      : rgb(layer.trail.colour === 'house' ? '#ffe2a8' : layer.trail.colour);
  sourceSpray(
    writer,
    (t) => starPos(layer, direction, t, centre),
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
      seed: seed * TRAIL_SEED_SCALE + index * TRAIL_LAYER_SEED_STEP + starIndex,
      alphaAt: strobe || twinkle ? undefined : (t) => fadeAlpha(fade, t, life),
      alpha: strobe ? STROBE_TRAIL_ALPHA : 1,
      inherit: 0,
    },
    () => ({ kind: 'star', layer, direction, centre, fade, life, fading: !strobe && !twinkle }),
  );
}
