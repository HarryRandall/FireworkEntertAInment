/** Pure prototype camera framing for live audience views and raised poster views. */
import { resolveDesign, type Design } from '../schema/index';
import type { Vec3 } from './colour';
import type { ShotPlacement } from './launch';
/** Prototype audience eye height above the ground, in metres. */
export const EYE_HEIGHT_M = 1.7;
/** Camera position and look target in world metres, independent of three.js. */
export interface Framing {
  position: Vec3;
  target: Vec3;
}
interface FramingShot extends ShotPlacement {
  design: Design;
}
// All values are prototype visual tuning: metres, radians, NDC fractions and scale factors.
const DEFAULT_ASPECT = 1.6;
const FOV_DEG = 45;
const HALF_TURN_DEG = 180;
const DEFAULT_HEIGHT_M = 60;
const DEFAULT_REACH_M = 26;
const HORIZON_NDC = -0.84;
const TOP_NDC = 0.85;
const WIDTH_PADDING = 1.1;
const MIN_DISTANCE_M = 40;
const NARROW_RATIO = 1.15;
const MIN_TILT_RAD = 0.12;
const NARROW_TOP_FRACTION = 0.6;
const TILT_REACH_M = 60;
const FOUNTAIN_GRAVITY_SCALE = 30;
const FOUNTAIN_MIN_TOP_M = 4;
const FOUNTAIN_REACH_M = 3;
const FOUNTAIN_SPACING_M = 1.2;
const COMET_REACH_M = 10;
const TOURBILLON_TOP_M = 45;
const TOURBILLON_REACH_M = 15;
const MINE_MIN_TOP_M = 30;
const MINE_TOP_SCALE = 1.6;
const MINE_REACH_SCALE = 0.7;
const SMALL_FOUNTAIN_SPEED_M_S = 10;
const SMALL_TARGET_M = 1.5;
const SMALL_CAMERA_M = 2.5;
const SMALL_POSTER_DISTANCE_M = 9;
const SMALL_LIVE_DISTANCE_M = 12;
const LOW_CAMERA_M = 4;
const RAISED_FRACTION = 0.55;
const SHOW_TARGET_FRACTION = 0.85;
const SHOW_DISTANCE_M = 140;
const SHOW_HEIGHT_SCALE = 0.8;
const SHOW_SPAN_SCALE = 1.4;
const POSTER_SCALE = 0.62;
const SHELL_DISTANCE_M = 62;
const SHELL_HEIGHT_SCALE = 0.75;
// Kind-specific poster tuning from the prototype: target metres, distance metres and height scale.
const MINE_TARGET_M = 24;
const MINE_DISTANCE_M = 95;
const FOUNTAIN_TARGET_M = 7;
const FOUNTAIN_DISTANCE_M = 45;
const WHEEL_TARGET_M = 6;
const WHEEL_DISTANCE_M = 45;
const SPINNER_TARGET_M = 1.5;
const SPINNER_DISTANCE_M = 28;
const CLIMB_DISTANCE_M = 30;
const CLIMB_HEIGHT_SCALE = 1.25;
const KIND_FRAME = {
  mine: [MINE_TARGET_M, MINE_DISTANCE_M, 0],
  fountain: [FOUNTAIN_TARGET_M, FOUNTAIN_DISTANCE_M, 0],
  wheel: [WHEEL_TARGET_M, WHEEL_DISTANCE_M, 0],
  spinner: [SPINNER_TARGET_M, SPINNER_DISTANCE_M, 0],
  comet: [0.5, CLIMB_DISTANCE_M, CLIMB_HEIGHT_SCALE],
  candle: [0.5, CLIMB_DISTANCE_M, CLIMB_HEIGHT_SCALE],
  tourbillon: [0.5, CLIMB_DISTANCE_M, CLIMB_HEIGHT_SCALE],
} as const;
function height(design: Design): number {
  if (design.kind === 'comet' || design.kind === 'candle') return design.ground.comets.height_m;
  if (design.kind === 'tourbillon') return design.ground.tourbillon.height_m;
  return design.launch?.height_m ?? DEFAULT_HEIGHT_M;
}
function extent(design: Design): { top: number; reach: number } {
  const reach = Math.max(
    0,
    ...design.breaks.flatMap((burst) =>
      burst.layers.map(
        (layer) => layer.radius_m * (1 + layer.speed_var / 2) + Math.hypot(...layer.offset_m),
      ),
    ),
  );
  switch (design.kind) {
    case 'fountain': {
      const fountain = design.ground.fountain;
      return {
        top:
          fountain.height_m +
          Math.max(FOUNTAIN_MIN_TOP_M, fountain.speed_m_s ** 2 / FOUNTAIN_GRAVITY_SCALE),
        reach:
          ((fountain.emitters - 1) *
            (fountain.spacing_m === 0 ? FOUNTAIN_SPACING_M : fountain.spacing_m)) /
            2 +
          FOUNTAIN_REACH_M,
      };
    }
    case 'comet':
    case 'candle':
      return { top: height(design), reach: COMET_REACH_M };
    case 'tourbillon':
      return { top: TOURBILLON_TOP_M, reach: TOURBILLON_REACH_M };
    case 'mine':
      return {
        top: Math.max(MINE_MIN_TOP_M, reach * MINE_TOP_SCALE),
        reach: reach * MINE_REACH_SCALE,
      };
    case 'shell':
    case 'rocket':
    case 'spinner':
    case 'wheel':
      return {
        top: height(design) + (reach === 0 ? DEFAULT_REACH_M : reach),
        reach: reach === 0 ? DEFAULT_REACH_M : reach,
      };
  }
}
function audience(
  shots: readonly FramingShot[],
  span: number,
  aspect: number,
  fov: number,
): Framing {
  const tangent = Math.tan((fov * Math.PI) / HALF_TURN_DEG / 2);
  const bounds = shots.map((shot) => extent(shot.design));
  const top = Math.max(0, ...bounds.map((bound) => bound.top));
  const reach = Math.max(0, ...bounds.map((bound) => bound.reach));
  let tilt = Math.atan(-HORIZON_NDC * tangent);
  // Fit the top and the widest launch line independently in the perspective frustum.
  const vertical = (top - EYE_HEIGHT_M) / Math.tan(tilt + Math.atan(TOP_NDC * tangent));
  const horizontal = (WIDTH_PADDING * (span + reach)) / (tangent * aspect);
  const distance = Math.max(vertical, horizontal, MIN_DISTANCE_M);
  if (horizontal > vertical * NARROW_RATIO)
    tilt = Math.max(
      MIN_TILT_RAD,
      Math.min(tilt, Math.atan((top * NARROW_TOP_FRACTION - EYE_HEIGHT_M) / distance)),
    );
  return {
    target: [0, EYE_HEIGHT_M + distance * Math.tan(tilt), 0],
    position: [0, EYE_HEIGHT_M, distance],
  };
}
function singleRaised(design: Design): { target: number; distance: number } {
  if (!(design.kind in KIND_FRAME))
    return {
      target: height(design),
      distance: SHELL_DISTANCE_M + height(design) * SHELL_HEIGHT_SCALE,
    };
  const kind = KIND_FRAME[design.kind as keyof typeof KIND_FRAME];
  return {
    target: kind[0] * (kind[2] > 0 ? height(design) : 1),
    distance: kind[1] + height(design) * kind[2],
  };
}
function raisedDistance(design: Design | undefined, distance: number, tight: boolean): number {
  if (design?.kind === 'fountain' && design.ground.fountain.emitters > 1) {
    const fountain = design.ground.fountain;
    const spacing = fountain.spacing_m === 0 ? FOUNTAIN_SPACING_M : fountain.spacing_m;
    return Math.max(MIN_DISTANCE_M, fountain.emitters * spacing * WIDTH_PADDING);
  }
  return distance * (tight ? POSTER_SCALE : 1);
}
function smallFountain(design: Design | undefined, tight: boolean): Framing | null {
  if (design?.kind === 'fountain') {
    const fountain = design.ground.fountain;
    if (fountain.speed_m_s < SMALL_FOUNTAIN_SPEED_M_S && fountain.emitters === 1)
      return {
        target: [0, SMALL_TARGET_M, 0],
        position: [0, SMALL_CAMERA_M, tight ? SMALL_POSTER_DISTANCE_M : SMALL_LIVE_DISTANCE_M],
      };
  }
  return null;
}
function raised(shots: readonly FramingShot[], tight: boolean, span: number): Framing {
  const design = shots.length === 1 ? shots[0]?.design : undefined;
  const small = smallFountain(design, tight);
  if (small) return small;
  const high = Math.max(0, ...shots.map((shot) => height(shot.design)));
  const frame = design
    ? singleRaised(design)
    : {
        target: high * SHOW_TARGET_FRACTION,
        distance: SHOW_DISTANCE_M + high * SHOW_HEIGHT_SCALE + span * SHOW_SPAN_SCALE,
      };
  const low = design?.kind === 'wheel' || design?.kind === 'spinner';
  return {
    target: [0, frame.target, 0],
    position: [
      0,
      low ? LOW_CAMERA_M : frame.target * RAISED_FRACTION,
      raisedDistance(design, frame.distance, tight),
    ],
  };
}
function needsRaised(shots: readonly FramingShot[]): boolean {
  const design = shots.length === 1 ? shots[0]?.design : undefined;
  if (!design) return false;
  if (design.kind === 'wheel' || design.kind === 'spinner') return true;
  return design.kind === 'fountain' && design.ground.fountain.emitters === 1;
}
function horizontalSpan(shot: FramingShot): number {
  const tilt = shot.design.launch?.tilt_deg ?? 0;
  return (
    Math.abs(shot.position?.[0] ?? 0) +
    Math.abs(Math.tan((tilt * Math.PI) / HALF_TURN_DEG)) * TILT_REACH_M
  );
}
/** Fits validated stored shots; aspect is width/height, fov is vertical degrees, output is metres.
 * Live views stand at audience height; tight views retain the prototype's raised poster framing. */
export function framingFor(
  shots: readonly FramingShot[],
  tight = false,
  aspect = DEFAULT_ASPECT,
  fov = FOV_DEG,
): Framing {
  if (!validProjection(aspect, fov))
    throw new RangeError('Framing needs a positive aspect and field of view below 180 degrees');
  const resolved = shots.map((shot) => ({ ...shot, design: resolveDesign(shot.design) }));
  const span = Math.max(0, ...resolved.map(horizontalSpan));
  return tight || needsRaised(resolved)
    ? raised(resolved, tight, span)
    : audience(resolved, span, aspect, fov);
}

function validProjection(aspect: number, fov: number): boolean {
  return (
    Number.isFinite(aspect) && aspect > 0 && Number.isFinite(fov) && fov > 0 && fov < HALF_TURN_DEG
  );
}
