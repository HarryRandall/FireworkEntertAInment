/** Prototype whoosh synthesis, with seeded variation and owned Web Audio nodes. */
import { decay } from './voice';
import type { SoundPlayback } from './playback';
// Prototype whoosh band hz, Hz.
const WHOOSH_BAND_HZ = 600;
// Prototype whoosh band q, dimensionless acoustic tuning.
const WHOOSH_BAND_Q = 1.2;
// Prototype whoosh start hz, Hz.
const WHOOSH_START_HZ = 500;
// Prototype whoosh end hz, Hz.
const WHOOSH_END_HZ = 1500;
// Prototype whoosh tail s, seconds.
const WHOOSH_TAIL_S = 0.3;
// Prototype whoosh noise offset max s, seconds.
const WHOOSH_NOISE_OFFSET_MAX_S = 1.5;
// Prototype whoosh gain, dimensionless acoustic tuning.
const WHOOSH_GAIN = 0.18;
// Prototype whoosh attack s, seconds.
const WHOOSH_ATTACK_S = 0.06;
// Prototype whoosh decay s, seconds.
const WHOOSH_DECAY_S = 0.35;
// Prototype whoosh hold trim s, seconds.
const WHOOSH_HOLD_TRIM_S = 0.25;
/** Schedules the whoosh voice at playback.when audio seconds; mutates only its owned graph. */
export function playWhoosh(playback: SoundPlayback): void {
  const { event, when, output, voice, random } = playback;
  // A rising shell or comet: a soft, breathy rush that brightens as it climbs.
  const bandpass = voice.filter('bandpass', WHOOSH_BAND_HZ, WHOOSH_BAND_Q);
  bandpass.frequency.setValueAtTime(WHOOSH_START_HZ, when);
  bandpass.frequency.exponentialRampToValueAtTime(WHOOSH_END_HZ, when + event.duration_s);
  bandpass.connect(output);
  const rush = voice.play(voice.buffers.white, when, bandpass, {
    duration: event.duration_s + WHOOSH_TAIL_S,
    loop: true,
    offset: random(0, WHOOSH_NOISE_OFFSET_MAX_S),
  });
  decay(rush.gain, when, [
    WHOOSH_GAIN,
    WHOOSH_ATTACK_S,
    WHOOSH_DECAY_S,
    Math.max(0, event.duration_s - WHOOSH_HOLD_TRIM_S),
  ]);
}
