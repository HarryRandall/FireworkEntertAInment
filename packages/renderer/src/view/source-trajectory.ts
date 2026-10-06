/** Copies analytic trajectory controls into metre/radian/second source texture lanes. */
import type { SprayTrajectory } from '../sim/spray-source';
import { LAUNCH_STYLES } from '../sim/launch-styles';
import { MUZZLE_M } from '../sim/launch';
import { sourceLane, SourceKind, SourceModifier, SOURCE_COMPONENTS } from './source-layout';

// Prototype launch angle conversion and default spiral tuning, degrees, metres and rad/s.
const HALF_TURN_DEG = 180;
const DEFAULT_SPIRAL_RADIUS_M = 0.9;
const DEFAULT_SPIRAL_RAD_S = 26;
// Prototype child drag coefficient, inverse seconds.
const CHILD_DRAG_PER_S = 3;
/** Writes one vector/tuple into a source texel; offset is a scalar index and lane is a texel index. */
export function writeSourceLane(
  data: Float32Array,
  offset: number,
  lane: number,
  values: readonly number[],
): void {
  data.set(values, offset + lane * SOURCE_COMPONENTS);
}
/** Copies a validated trajectory into its fixed texture record without sampling births or motion. */
export function packTrajectory(
  data: Float32Array,
  offset: number,
  trajectory: SprayTrajectory,
): void {
  switch (trajectory.kind) {
    case 'launch':
      packLaunch(data, offset, trajectory);
      break;
    case 'star':
      packStar(data, offset, trajectory);
      break;
    case 'fixed':
      writeSourceLane(data, offset, sourceLane.trajectory, [SourceKind.Fixed]);
      writeSourceLane(data, offset, sourceLane.origin, trajectory.origin);
      break;
    case 'wheel':
    case 'spinner':
      packRotating(data, offset, trajectory);
      break;
    case 'tourbillon':
    case 'comet':
      packClimbing(data, offset, trajectory);
      break;
    case 'child':
      writeSourceLane(data, offset, sourceLane.trajectory, [SourceKind.Child]);
      writeSourceLane(data, offset, sourceLane.origin, trajectory.origin);
      writeSourceLane(data, offset, sourceLane.travel, [
        trajectory.reach,
        CHILD_DRAG_PER_S,
        trajectory.gravity,
        trajectory.start,
      ]);
      writeSourceLane(data, offset, sourceLane.starDirection, trajectory.direction);
      break;
  }
}
function packLaunch(
  data: Float32Array,
  offset: number,
  trajectory: Extract<SprayTrajectory, { kind: 'launch' }>,
): void {
  const { launch, seed, placement } = trajectory;
  const style = LAUNCH_STYLES[launch.tail];
  const [x, z] = placement.position ?? [0, 0];
  writeSourceLane(data, offset, sourceLane.trajectory, [SourceKind.Launch]);
  writeSourceLane(data, offset, sourceLane.origin, [
    x,
    placement.muzzle_m ?? MUZZLE_M,
    z,
    seed % (Math.PI * 2),
  ]);
  writeSourceLane(data, offset, sourceLane.travel, [
    launch.height_m,
    launch.time_s,
    Math.tan((launch.tilt_deg * Math.PI) / HALF_TURN_DEG),
    0,
  ]);
  writeSourceLane(data, offset, sourceLane.shape, [
    style.jitter ?? 0,
    style.wobble ?? 0,
    style.spiral === true ? (style.spiralR ?? DEFAULT_SPIRAL_RADIUS_M) : 0,
    style.spiralRate ?? DEFAULT_SPIRAL_RAD_S,
  ]);
  writeSourceLane(data, offset, sourceLane.embellishment, [style.spiralKeep === true ? 1 : 0]);
}
function packStar(
  data: Float32Array,
  offset: number,
  trajectory: Extract<SprayTrajectory, { kind: 'star' }>,
): void {
  const { layer, direction, centre, fade, life, fading } = trajectory;
  writeSourceLane(data, offset, sourceLane.trajectory, [SourceKind.Star]);
  writeSourceLane(data, offset, sourceLane.origin, centre);
  writeSourceLane(data, offset, sourceLane.travel, [
    layer.radius_m * (1 - layer.speed_var + layer.speed_var * direction.h),
    layer.drag_per_s,
    layer.gravity_m_s2,
    layer.radius_m,
  ]);
  writeSourceLane(data, offset, sourceLane.starDirection, [direction.x, direction.y, direction.z]);
  writeSourceLane(data, offset, sourceLane.fade, [fading ? 1 : 0, fade.fade_at, life]);
  let count = 0;
  for (const modifier of layer.modifiers) {
    const controls = motionControls(modifier, layer.pattern === 'spiral');
    if (controls) writeSourceLane(data, offset, sourceLane.modifiers + count++, controls);
  }
  writeSourceLane(data, offset, sourceLane.starPhase, [direction.ph, count]);
}
function motionControls(
  modifier: Extract<SprayTrajectory, { kind: 'star' }>['layer']['modifiers'][number],
  spiral: boolean,
): number[] | undefined {
  switch (modifier.kind) {
    case 'twist':
      return [SourceModifier.Twist, modifier.angular_speed_rad_s, spiral ? 1 : 0];
    case 'fish':
      return [SourceModifier.Fish, modifier.rate_rad_s, modifier.amount];
    case 'bees':
      return [SourceModifier.Bees];
    case 'flutter':
      return [SourceModifier.Flutter, modifier.amount];
    case 'crackle':
    case 'crossette':
    case 'ghost':
    case 'glitter':
    case 'pop':
    case 'split':
    case 'strobe':
    case 'twinkle':
    case 'whistle':
      return undefined;
  }
}
function packRotating(
  data: Float32Array,
  offset: number,
  trajectory: Extract<SprayTrajectory, { kind: 'wheel' | 'spinner' }>,
): void {
  const kind = trajectory.kind === 'wheel' ? SourceKind.Wheel : SourceKind.Spinner;
  const radius = trajectory.kind === 'wheel' ? trajectory.radius : trajectory.wander;
  writeSourceLane(data, offset, sourceLane.trajectory, [kind]);
  writeSourceLane(data, offset, sourceLane.origin, trajectory.centre);
  writeSourceLane(data, offset, sourceLane.travel, [radius, trajectory.speed, trajectory.phase]);
}
function packClimbing(
  data: Float32Array,
  offset: number,
  trajectory: Extract<SprayTrajectory, { kind: 'tourbillon' | 'comet' }>,
): void {
  const kind = trajectory.kind === 'tourbillon' ? SourceKind.Tourbillon : SourceKind.Comet;
  writeSourceLane(data, offset, sourceLane.trajectory, [kind]);
  writeSourceLane(data, offset, sourceLane.origin, trajectory.centre);
  writeSourceLane(data, offset, sourceLane.travel, [
    trajectory.height,
    trajectory.duration,
    trajectory.speed,
    trajectory.radius,
  ]);
  const angles =
    trajectory.kind === 'tourbillon' ? [trajectory.offset, 0] : [trajectory.angle, trajectory.yaw];
  writeSourceLane(data, offset, sourceLane.shape, [...angles, trajectory.phase]);
}
