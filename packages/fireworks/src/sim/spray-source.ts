/** Analytic source hand-off for GPU births; the CPU reference still samples its original callbacks. */
import type { Fade, Layer, Launch } from '../schema/index';
import type { Vec3 } from './colour';
import type { StarDirection } from './directions';
import type { ShotPlacement } from './launch';
import type { ParticleWriter } from './particles';
import { spray, type SprayOptions } from './spray';

/** Source trajectory inputs in metres, radians and source-relative seconds.
 * Ground tuple layouts are documented where their shader equations are packed. */
export type SprayTrajectory =
  | { kind: 'launch'; launch: Launch; seed: number; placement: ShotPlacement }
  | {
      kind: 'star';
      layer: Layer;
      direction: StarDirection;
      centre: Vec3;
      fade: Fade;
      life: number;
      fading: boolean;
    }
  | { kind: 'fixed'; origin: Vec3 }
  | { kind: 'wheel'; centre: Vec3; radius: number; speed: number; phase: number }
  | { kind: 'spinner'; centre: Vec3; wander: number; speed: number; phase: number }
  | {
      kind: 'tourbillon';
      centre: Vec3;
      height: number;
      duration: number;
      offset: number;
      speed: number;
      radius: number;
      phase: number;
    }
  | {
      kind: 'comet';
      centre: Vec3;
      height: number;
      duration: number;
      angle: number;
      yaw: number;
      speed: number;
      radius: number;
      phase: number;
    }
  | { kind: 'child'; origin: Vec3; direction: Vec3; reach: number; gravity: number; start: number };

/** Synchronous per-source hand-off. Times are source-clock seconds; options are validated.
 * The receiver copies controls before returning and never calls the CPU trajectory callback. */
// eslint-disable-next-line max-params -- Source clock bounds and trajectory controls remain separate at this synchronous boundary.
export type SpraySourceSink = (
  trajectory: SprayTrajectory,
  start: number,
  end: number,
  now: number,
  options: SprayOptions,
) => void;

/** Emits one analytic GPU source or invokes the unchanged CPU reference.
 * Times are seconds on the same source clock; lazy trajectory construction avoids CPU-path overhead. */
// eslint-disable-next-line max-params -- Matches the reference spray API and adds only lazy analytic source controls, avoiding per-spark wrappers.
export function sourceSpray(
  writer: ParticleWriter,
  source: (time: number) => Vec3,
  start: number,
  end: number,
  now: number,
  options: SprayOptions,
  trajectory: () => SprayTrajectory,
): void {
  if (!writer.sprays) return;
  if (!writer.spraySource) {
    spray(writer, source, start, end, now, options);
    return;
  }
  writer.sprayPhase?.(true);
  try {
    if (options.count > 0) writer.spraySource(trajectory(), start, end, now, options);
    // A dual receiver lets parity tests observe the original callbacks at the same source boundary.
    if (writer.sprayBirth) spray(writer, source, start, end, now, options);
  } finally {
    writer.sprayPhase?.(false);
  }
}
