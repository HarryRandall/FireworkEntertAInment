/** Float64-reduced phase anchors; CPU work remains bounded by sources and modifiers. */
import type { SprayTrajectory } from '../sim/spray-source';
import { LAUNCH_STYLES } from '../sim/launch-styles';
import { sourceLane } from './source-layout';
import { writeSourceLane } from './source-trajectory';
import { motionTuning as tuning } from './source-motion-kernel';

// Full turn in radians; reduce before the Float32 texture conversion, never after it.
const FULL_TURN_RAD = 2 * Math.PI;
// Prototype launch spiral speed when the style omits it, radians per second.
const DEFAULT_SPIRAL_RAD_S = 26;
// Two RGBA texels hold the six independent bee harmonic phases per modifier.
const MODIFIER_PHASE_TEXELS = 2;

/** Packs phases at anchor seconds on the source clock; no births or trajectories are sampled. */
export function packSourcePhases(
  data: Float32Array,
  trajectory: SprayTrajectory,
  anchor: number,
): void {
  const phases = trajectoryPhases(trajectory, anchor);
  writePhases(data, sourceLane.phases, phases);
  if (trajectory.kind !== 'star') return;
  let index = 0;
  for (const modifier of trajectory.layer.modifiers) {
    const values = modifierPhases(modifier, anchor, trajectory.direction.ph);
    if (!values) continue;
    writePhases(data, sourceLane.modifierPhases + index * MODIFIER_PHASE_TEXELS, values);
    index++;
  }
}
function writePhases(data: Float32Array, lane: number, phases: number[]): void {
  writeSourceLane(
    data,
    0,
    lane,
    phases.map((phase) => phase % FULL_TURN_RAD),
  );
}
function trajectoryPhases(trajectory: SprayTrajectory, time: number): number[] {
  switch (trajectory.kind) {
    case 'launch': {
      const phase = trajectory.seed;
      const style = LAUNCH_STYLES[trajectory.launch.tail];
      return [
        time * tuning.CLIMB_SWAY_RAD_S + phase,
        time * tuning.JITTER_X_RAD_S + phase,
        time * tuning.JITTER_Z_RAD_S + phase,
        time * tuning.WOBBLE_X_RAD_S + phase,
        time * tuning.WOBBLE_Z_RAD_S + phase,
        time * (style.spiralRate ?? DEFAULT_SPIRAL_RAD_S) + phase,
      ];
    }
    case 'wheel':
      return [
        (time < tuning.WHEEL_RAMP_S
          ? 0.5 * trajectory.speed * time * time
          : trajectory.speed * (time - tuning.WHEEL_RAMP_S / 2)) + trajectory.phase,
      ];
    case 'spinner':
      return [
        time * trajectory.speed,
        time * tuning.SPINNER_X_RAD_S + trajectory.phase,
        time * tuning.SPINNER_X_HARMONIC_RAD_S + trajectory.phase * 2,
        time * tuning.SPINNER_BOUNCE_RAD_S + trajectory.phase,
        time * tuning.SPINNER_Z_RAD_S + trajectory.phase,
      ];
    case 'tourbillon':
    case 'comet':
      return [time * trajectory.speed + trajectory.phase];
    case 'star':
    case 'child':
    case 'fixed':
      return [];
  }
}
function modifierPhases(
  modifier: Extract<SprayTrajectory, { kind: 'star' }>['layer']['modifiers'][number],
  time: number,
  phase: number,
): number[] | undefined {
  switch (modifier.kind) {
    case 'twist':
      return [modifier.angular_speed_rad_s * time];
    case 'fish':
      return [
        time * modifier.rate_rad_s + phase,
        time * modifier.rate_rad_s * tuning.FISH_VERTICAL_RATIO + phase,
      ];
    case 'flutter':
      return [time * tuning.FLUTTER_X_RAD_S + phase, time * tuning.FLUTTER_Z_RAD_S + phase];
    case 'bees': {
      const angle = time * tuning.BEE_RATE_RAD_S + phase;
      return [
        angle * tuning.BEE_X_RATE,
        angle * tuning.BEE_X_HARMONIC,
        angle * tuning.BEE_Y_RATE + tuning.BEE_Y_PHASE_RAD,
        angle * tuning.BEE_Y_HARMONIC,
        angle * tuning.BEE_Z_RATE + tuning.BEE_Z_PHASE_RAD,
        angle * tuning.BEE_Z_HARMONIC,
      ];
    }
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
