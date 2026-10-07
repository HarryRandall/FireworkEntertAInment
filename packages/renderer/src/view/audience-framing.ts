/** Optional audience breathing room at the browser playback boundary. */
import { framingFor, type Framing } from '../sim/framing';
import type { Shot } from './types';

interface AudienceView {
  shots: readonly Shot[];
  camera: { aspect: number; fov: number };
  options: { framingDistanceScale?: number };
}

/** Moves the camera back along its viewing direction without shifting the stage target. */
export function audienceFraming(view: AudienceView): Framing {
  const framing = framingFor(view.shots, false, view.camera.aspect, view.camera.fov);
  const distanceScale = view.options.framingDistanceScale ?? 1;
  const scale = Number.isFinite(distanceScale) ? Math.max(1, distanceScale) : 1;
  const [x, y, z] = framing.position;
  const [tx, ty, tz] = framing.target;
  return {
    ...framing,
    position: [tx + (x - tx) * scale, ty + (y - ty) * scale, tz + (z - tz) * scale],
  };
}
