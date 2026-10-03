/** Fixed review camera fitting from CPU bounds, independent of the live spray path. */
import type { PerspectiveCamera } from 'three';
import { resolveDesign, type Design } from '../schema/index';
import { simulate, shotDuration } from '../sim/index';
import type { Shot } from './types';
// Prototype perspective field of view, degrees.
const FOV_DEG = 45;
// Degrees in half a turn, for radian conversion.
const HALF_TURN_DEG = 180;
// Cartesian scalar lanes per packed position.
const VECTOR_COMPONENTS = 3;
// Basic fixed view padding and floor, chosen for legible review frames in any aspect ratio.
const FIT_PADDING = 1.3;
const MIN_EXTENT_M = 4;
const CAMERA_HEIGHT_FRACTION = 0.55;
/** Fits a camera to sampled metre bounds for shots at their review instants; mutates camera only. */
export function fitReviewCamera(camera: PerspectiveCamera, shots: readonly Shot[]): void {
  let minX = -MIN_EXTENT_M;
  let maxX = MIN_EXTENT_M;
  let top = MIN_EXTENT_M;
  for (const shot of shots) {
    const design = resolveDesign(shot.design);
    const preview = simulate(design, reviewTime(design), shot);
    for (let i = 0; i < preview.positions.length; i += VECTOR_COMPONENTS) {
      minX = Math.min(minX, preview.positions[i] ?? 0);
      maxX = Math.max(maxX, preview.positions[i] ?? 0);
      top = Math.max(top, preview.positions[i + 1] ?? 0);
    }
    top = Math.max(top, design.launch?.height_m ?? 0);
  }
  const targetY = top / 2;
  const halfWidth = (maxX - minX) / 2;
  // A perspective frustum grows by tan(fov/2); the larger dimension sets distance.
  const distance =
    (FIT_PADDING * Math.max(top / 2, halfWidth / camera.aspect)) /
    Math.tan((FOV_DEG * Math.PI) / HALF_TURN_DEG / 2);
  camera.position.set((minX + maxX) / 2, targetY * CAMERA_HEIGHT_FRACTION, distance);
  camera.lookAt((minX + maxX) / 2, targetY, 0);
}
// Review stills show developed trails: half a second after apex, or half way through ground effects.
const REVIEW_AFTER_APEX_S = 0.5;
const GROUND_REVIEW_FRACTION = 0.4;
/** Chooses a readable review time in seconds for a stored design. */
export function reviewTime(design: Design): number {
  return design.launch
    ? design.launch.time_s + REVIEW_AFTER_APEX_S
    : shotDuration(design) * GROUND_REVIEW_FRACTION;
}
