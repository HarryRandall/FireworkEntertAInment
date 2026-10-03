/** Deterministic rotational shake from large shell booms arriving at the audience. */
import { resolveDesign, type Design } from '../schema/index';
import { hash } from './random';
import type { Vec3 } from './colour';
import type { ShotPlacement } from './launch';
interface ShakeShot extends ShotPlacement {
  design: Design;
  t0?: number;
}
/** A burst on the sequence clock: seconds, world metres, relative size and seeded radians. */
export interface ShakeEvent {
  time_s: number;
  position: Vec3;
  size: number;
  phase: number;
}
// Prototype acoustic delay: speed in m/s and maximum lag in seconds.
const SOUND_SPEED_M_S = 343;
const MAX_LAG_S = 1.5;
// Prototype visual tuning: angular radians, reference metres, envelope seconds and hash selectors.
const AMPLITUDE_RAD = 0.0035;
const REFERENCE_M = 80;
const MAX_RAD = 0.006;
const MIN_RAD = 0.0006;
const LENGTH_S = 0.9;
const MIN_SIZE = 0.6;
const REFERENCE_RADIUS_M = 26;
const PHASE_STREAM = 77;
const MS_PER_S = 1000;
const FULL_TURN = 6.2832;
const RISE_S = 0.012;
const DECAY_S = 0.22;
const DISTANCE_POWER = 1.5;
const PITCH_HZ = 11;
const PITCH_SECONDARY_HZ = 17.3;
const PITCH_PHASE = 2.1;
const YAW_GAIN = 0.7;
const YAW_HZ = 9.1;
const YAW_PHASE = 1.3;
const YAW_SECONDARY_HZ = 15.7;
const YAW_SECONDARY_PHASE = 0.7;
const ROLL_GAIN = 0.25;
const ROLL_HZ = 7.3;
const ROLL_PHASE = 3.1;
/** Returns acoustic travel delay in seconds for a non-negative distance in metres. */
export function soundLag(distance_m: number): number {
  return Math.min(MAX_LAG_S, Math.max(0, distance_m) / SOUND_SPEED_M_S);
}
/** Builds large-boom events from stored shell breaks, sorted by seconds from sequence start. */
export function shakeEvents(shots: readonly ShakeShot[]): ShakeEvent[] {
  const events: ShakeEvent[] = [];
  for (const shot of shots) {
    const design = resolveDesign(shot.design);
    if (design.kind !== 'shell' && design.kind !== 'rocket') continue;
    appendShellEvents(events, shot, design);
  }
  events.sort((left, right) => left.time_s - right.time_s);
  // The prototype seeds qualifying booms in chronological order.
  events.forEach((event, index) => {
    event.phase = hash(index, Math.round(event.time_s * MS_PER_S), PHASE_STREAM) * FULL_TURN;
  });
  return events;
}
/** Computes pitch/yaw/roll radians at sequence seconds and an unshaken metre camera position.
 * Mutates only out; direct seeks and repeated evaluations have identical results. */
export function shakeAt(
  events: readonly ShakeEvent[],
  time_s: number,
  camera: Vec3,
  out: Vec3,
): Vec3 {
  out.fill(0);
  for (const event of events) {
    if (event.time_s < time_s - LENGTH_S - MAX_LAG_S) continue;
    if (event.time_s > time_s) break;
    const distance = Math.hypot(
      camera[0] - event.position[0],
      camera[1] - event.position[1],
      camera[2] - event.position[2],
    );
    const age = time_s - event.time_s - soundLag(distance);
    if (age < 0 || age > LENGTH_S) continue;
    const amplitude = Math.min(
      MAX_RAD,
      AMPLITUDE_RAD * event.size * (REFERENCE_M / distance) ** DISTANCE_POWER,
    );
    if (amplitude < MIN_RAD) continue;
    addShake(event, age, amplitude, out);
  }
  return out;
}
function addShake(event: ShakeEvent, age: number, amplitude: number, out: Vec3): void {
  // A fast attack and decaying mixed frequencies imitate a short shock without accumulated jitter.
  const envelope = (1 - Math.exp(-age / RISE_S)) * Math.exp(-age / DECAY_S);
  const wave = FULL_TURN * age;
  const phase = event.phase;
  out[0] +=
    amplitude *
    envelope *
    (Math.sin(wave * PITCH_HZ + phase) +
      0.5 * Math.sin(wave * PITCH_SECONDARY_HZ + phase * PITCH_PHASE));
  out[1] +=
    amplitude *
    envelope *
    YAW_GAIN *
    (Math.sin(wave * YAW_HZ + phase * YAW_PHASE) +
      0.5 * Math.sin(wave * YAW_SECONDARY_HZ + phase * YAW_SECONDARY_PHASE));
  out[2] += amplitude * envelope * ROLL_GAIN * Math.sin(wave * ROLL_HZ + phase * ROLL_PHASE);
}

function appendShellEvents(
  events: ShakeEvent[],
  shot: ShakeShot,
  design: Extract<Design, { launch: object }>,
): void {
  for (const burst of design.breaks) {
    const seen = new Set<number>();
    for (const layer of burst.layers) {
      if (seen.has(layer.delay_s)) continue;
      seen.add(layer.delay_s);
      const size = (burst.core.flash * layer.radius_m) / REFERENCE_RADIUS_M;
      if (size < MIN_SIZE) continue;
      events.push({
        time_s: (shot.t0 ?? 0) + design.launch.time_s + burst.at_s + layer.delay_s,
        position: [
          (shot.position?.[0] ?? 0) + layer.offset_m[0],
          design.launch.height_m + layer.offset_m[1],
          shot.position?.[1] ?? 0,
        ],
        size,
        phase: 0,
      });
    }
  }
}
