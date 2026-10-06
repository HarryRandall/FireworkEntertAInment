/** Dispatches acoustic cues to their synthesis family using a deterministic random stream. */
import type { SoundEvent } from '../../sim/events';
import { hash } from '../../sim/random';
import type { SoundVoice } from './voice';
import { playBoom } from './boom';
import { playLift } from './lift';
import { playWhoosh } from './whoosh';
import { playWhistle } from './whistle';
import { playHiss } from './hiss';
import { playCrackle } from './crackle';
/** Audio-clock start, event bus and local seeded variation passed to one synthesis family. */
export interface SoundPlayback {
  event: SoundEvent;
  when: number;
  output: AudioNode;
  voice: SoundVoice;
  random: (min: number, max: number) => number;
}
const synthesis = {
  boom: playBoom,
  lift: playLift,
  whoosh: playWhoosh,
  whistle: playWhistle,
  hiss: playHiss,
  crackle: playCrackle,
};
/** Schedules one cue on an owned bus at audio seconds; variation depends only on event.seed. */
export function playSound(playback: Omit<SoundPlayback, 'random'>): void {
  let sample = 0;
  synthesis[playback.event.kind]({
    ...playback,
    random(min, max) {
      return min + hash(playback.event.seed, sample++, 0) * (max - min);
    },
  });
}
