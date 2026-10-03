/** Poster cameras isolate shell bursts while retaining climbs for other kinds. */
import { framingFor, type Framing } from '../sim/framing';
import type { Shot } from '../view/types';

// Prototype card aspect, dimensionless; narrower posters need extra horizontal room.
const CARD_ASPECT = 1.6;

/** Returns world-metre framing for validated shots, width/height aspect and vertical FOV degrees.
 * Only a single shell uses the tight burst camera; sequences and climbs retain audience bounds. */
export function posterFraming(shots: readonly Shot[], aspect: number, fov: number): Framing {
  const tight = shots.length === 1 && shots[0]?.design.kind === 'shell';
  const framing = framingFor(shots, tight, aspect, fov);
  if (!tight || aspect >= CARD_ASPECT) return framing;
  // Increase the camera-target distance to fit the same burst in a narrower frustum.
  const scale = CARD_ASPECT / aspect;
  return {
    target: framing.target,
    position: [
      framing.target[0] + (framing.position[0] - framing.target[0]) * scale,
      framing.target[1] + (framing.position[1] - framing.target[1]) * scale,
      framing.target[2] + (framing.position[2] - framing.target[2]) * scale,
    ],
  };
}
