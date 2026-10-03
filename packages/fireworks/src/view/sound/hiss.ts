/** Prototype hiss synthesis, with seeded variation and owned Web Audio nodes. */
import { decay } from './voice';
import type { SoundPlayback } from './playback';
// Prototype hiss loud hz, Hz.
const HISS_LOUD_HZ = 2600;
// Prototype hiss soft hz, Hz.
const HISS_SOFT_HZ = 4200;
// Prototype hiss band q, dimensionless acoustic tuning.
const HISS_BAND_Q = 0.5;
// Prototype hiss noise offset max s, seconds.
const HISS_NOISE_OFFSET_MAX_S = 1.5;
// Prototype hiss loud gain, dimensionless acoustic tuning.
const HISS_LOUD_GAIN = 0.3;
// Prototype hiss soft gain, dimensionless acoustic tuning.
const HISS_SOFT_GAIN = 0.1;
// Prototype hiss attack s, seconds.
const HISS_ATTACK_S = 0.15;
// Prototype hiss decay s, seconds.
const HISS_DECAY_S = 0.4;
// Prototype hiss loud pops per second.
const HISS_LOUD_POPS_PER_S = 26;
// Prototype hiss soft pops per second.
const HISS_SOFT_POPS_PER_S = 10;
// Prototype hiss pop min gain, dimensionless acoustic tuning.
const HISS_POP_MIN_GAIN = 0.05;
// Prototype hiss pop max gain, dimensionless acoustic tuning.
const HISS_POP_MAX_GAIN = 0.2;
// Prototype hiss pop min rate, dimensionless acoustic tuning.
const HISS_POP_MIN_RATE = 0.7;
// Prototype hiss pop max rate, dimensionless acoustic tuning.
const HISS_POP_MAX_RATE = 1.4;
// Prototype hiss tail and envelope hold trim, in seconds.
const HISS_TAIL_S = 0.5;
const HISS_HOLD_TRIM_S = 0.3;
/** Schedules the hiss voice at playback.when audio seconds; mutates only its owned graph. */
export function playHiss(playback: SoundPlayback): void {
  const { event, when, output, voice, random } = playback;
  // Fountains, spinners and glitter: a spitting roar, noise with a little grain.
  const bandpass = voice.filter('bandpass', event.loud ? HISS_LOUD_HZ : HISS_SOFT_HZ, HISS_BAND_Q);
  bandpass.connect(output);
  const noise = voice.play(voice.buffers.white, when, bandpass, {
    duration: event.duration_s + HISS_TAIL_S,
    loop: true,
    offset: random(0, HISS_NOISE_OFFSET_MAX_S),
  });
  decay(noise.gain, when, [
    event.loud ? HISS_LOUD_GAIN : HISS_SOFT_GAIN,
    HISS_ATTACK_S,
    HISS_DECAY_S,
    Math.max(0, event.duration_s - HISS_HOLD_TRIM_S),
  ]);
  const pops = Math.round(
    event.duration_s * (event.loud ? HISS_LOUD_POPS_PER_S : HISS_SOFT_POPS_PER_S),
  );
  for (let popIndex = 0; popIndex < pops; popIndex++)
    voice.play(voice.buffers.pop, when + random(0, 1) * event.duration_s, output, {
      gain: random(HISS_POP_MIN_GAIN, HISS_POP_MAX_GAIN),
      rate: random(HISS_POP_MIN_RATE, HISS_POP_MAX_RATE),
    });
}
