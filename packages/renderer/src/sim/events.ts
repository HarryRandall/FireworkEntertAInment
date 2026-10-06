/** Pure sound cues on the sequence clock, resolved from the stored design without audio APIs. */
import { resolveDesign, type Design } from '../schema/index';
import type { Vec3 } from './colour';
import type { ShotPlacement } from './launch';
import { hash } from './random';
import { shellSoundEvents, groundSoundEvents } from './sound-sources';

/** One firing, using sequence seconds, horizontal metres and an optional seed override. */
export interface SoundShot extends ShotPlacement {
  design: Design;
  t0?: number;
  seed?: number;
}
/** Prototype synthesis families; their voices are created exclusively in the browser view. */
export type SoundKind = 'lift' | 'whoosh' | 'boom' | 'crackle' | 'whistle' | 'hiss';
/** An immutable cue: sequence seconds, world metres and deterministic synthesis seed. */
export interface SoundEvent {
  time_s: number;
  kind: SoundKind;
  position: Vec3;
  distance_m: number;
  seed: number;
  duration_s: number;
  size: number;
  quiet: boolean;
  heavy: boolean;
  loud: boolean;
  soft: boolean;
}
// Independent deterministic stream for acoustic variation, dimensionless hash selector.
const SOUND_STREAM = 83;
// Hash output is a fraction; unsigned 32-bit scaling preserves the full seed range.
const SEED_RANGE = 4294967296;
/** Builds chronological cues with metre distances to a finite listener position (default world origin).
 * Shot times are sequence seconds; validated designs and inputs are not mutated. */
export function soundEvents(shots: readonly SoundShot[], listener: Vec3 = [0, 0, 0]): SoundEvent[] {
  const events: SoundEvent[] = [];
  shots.forEach((shot, shotIndex) => {
    const design = resolveDesign(shot.design);
    const cues = design.ground === null ? shellSoundEvents(design) : groundSoundEvents(design);
    cues.forEach((cue, cueIndex) => {
      const position: Vec3 = [
        cue.position[0] + (shot.position?.[0] ?? 0),
        cue.position[1],
        cue.position[2] + (shot.position?.[1] ?? 0),
      ];
      events.push({
        ...cue,
        time_s: cue.time_s + (shot.t0 ?? 0),
        position,
        distance_m: soundDistance({ position }, listener),
        seed: Math.floor(
          hash(shot.seed ?? design.seed, shotIndex, cueIndex + SOUND_STREAM) * SEED_RANGE,
        ),
      });
    });
  });
  return events.sort((left, right) => left.time_s - right.time_s);
}
/** Returns metres from a cue's source to the unshaken listener position; no inputs are mutated. */
export function soundDistance(event: Pick<SoundEvent, 'position'>, listener: Vec3): number {
  return Math.hypot(
    event.position[0] - listener[0],
    event.position[1] - listener[1],
    event.position[2] - listener[2],
  );
}
