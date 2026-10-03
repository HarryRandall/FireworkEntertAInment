/** Prototype boom synthesis, with seeded variation and owned Web Audio nodes. */
import { prototypeOr } from '../../sim/numeric';
import { decay } from './voice';
import type { SoundPlayback } from './playback';
// Prototype boom max size, dimensionless acoustic tuning.
const BOOM_MAX_SIZE = 3;
// Prototype boom crack gain, dimensionless acoustic tuning.
const BOOM_CRACK_GAIN = 1.4;
// Prototype boom crack size limit, dimensionless acoustic tuning.
const BOOM_CRACK_SIZE_LIMIT = 1.6;
// Prototype boom crack rate min, dimensionless acoustic tuning.
const BOOM_CRACK_RATE_MIN = 0.8;
// Prototype boom crack rate max, dimensionless acoustic tuning.
const BOOM_CRACK_RATE_MAX = 1.1;
// Prototype boom crack highpass hz, Hz.
const BOOM_CRACK_HIGHPASS_HZ = 180;
// Prototype boom air band hz, Hz.
const BOOM_AIR_BAND_HZ = 2400;
// Prototype boom air q, dimensionless acoustic tuning.
const BOOM_AIR_Q = 0.6;
// Prototype boom air length s, seconds.
const BOOM_AIR_LENGTH_S = 0.08;
// Prototype boom noise offset max s, seconds.
const BOOM_NOISE_OFFSET_MAX_S = 1.5;
// Prototype boom body close s, seconds.
const BOOM_BODY_CLOSE_S = 0.35;
// Prototype boom air attack s, seconds.
const BOOM_AIR_ATTACK_S = 0.001;
// Prototype boom air decay s, seconds.
const BOOM_AIR_DECAY_S = 0.06;
// Prototype boom body lowpass hz, Hz.
const BOOM_BODY_LOWPASS_HZ = 900;
// Prototype boom body start hz, Hz.
const BOOM_BODY_START_HZ = 1600;
// Prototype boom body end hz, Hz.
const BOOM_BODY_END_HZ = 160;
// Prototype boom body length s, seconds.
const BOOM_BODY_LENGTH_S = 1.2;
// Prototype boom body gain, dimensionless acoustic tuning.
const BOOM_BODY_GAIN = 1.3;
// Prototype boom body attack s, seconds.
const BOOM_BODY_ATTACK_S = 0.003;
// Prototype boom rumble lowpass hz, Hz.
const BOOM_RUMBLE_LOWPASS_HZ = 140;
// Prototype boom rumble delay s, seconds.
const BOOM_RUMBLE_DELAY_S = 0.02;
// Prototype boom rumble rate, dimensionless acoustic tuning.
const BOOM_RUMBLE_RATE = 0.7;
// Prototype boom rumble attack s, seconds.
const BOOM_RUMBLE_ATTACK_S = 0.04;
// Prototype burst size floor, normalised radius/flash product.
const BOOM_MIN_SIZE = 0.5;
// Prototype burst envelope durations, in seconds per unit burst size.
const BOOM_BODY_DECAY_S = 0.5;
const BOOM_RUMBLE_LENGTH_S = 3;
const BOOM_RUMBLE_DECAY_S = 1.6;
// Prototype air and rumble peak levels, linear gain.
const BOOM_AIR_GAIN = 0.35;
const BOOM_RUMBLE_GAIN = 1.1;
/** Schedules the boom voice at playback.when audio seconds; mutates only its owned graph. */
export function playBoom(playback: SoundPlayback): void {
  const { event, when, output, voice, random } = playback;
  const size = Math.max(BOOM_MIN_SIZE, Math.min(BOOM_MAX_SIZE, prototypeOr(event.size, 1)));
  // Crack: the shock front, bright and very short.
  const crack = voice.filter('highpass', BOOM_CRACK_HIGHPASS_HZ);
  crack.connect(output);
  voice.play(voice.buffers.nwave, when, crack, {
    gain: BOOM_CRACK_GAIN * Math.min(BOOM_CRACK_SIZE_LIMIT, size),
    rate: random(BOOM_CRACK_RATE_MIN, BOOM_CRACK_RATE_MAX) / Math.sqrt(size),
  });
  const air = voice.filter('bandpass', BOOM_AIR_BAND_HZ, BOOM_AIR_Q);
  air.connect(output);
  const hiss = voice.play(voice.buffers.white, when, air, {
    duration: BOOM_AIR_LENGTH_S,
    offset: random(0, BOOM_NOISE_OFFSET_MAX_S),
  });
  decay(hiss.gain, when, [BOOM_AIR_GAIN, BOOM_AIR_ATTACK_S, BOOM_AIR_DECAY_S]);
  // Body: a thump of low-mid energy that closes down fast.
  const body = voice.filter('lowpass', BOOM_BODY_LOWPASS_HZ);
  body.frequency.setValueAtTime(BOOM_BODY_START_HZ, when);
  body.frequency.exponentialRampToValueAtTime(BOOM_BODY_END_HZ, when + BOOM_BODY_CLOSE_S * size);
  const bodyNoise = voice.play(voice.buffers.brown, when, body, {
    duration: BOOM_BODY_LENGTH_S * size,
    offset: random(0, BOOM_NOISE_OFFSET_MAX_S),
  });
  body.connect(output);
  decay(bodyNoise.gain, when, [BOOM_BODY_GAIN, BOOM_BODY_ATTACK_S, BOOM_BODY_DECAY_S * size]);
  // Rumble: the low tail that rolls away.
  const rumble = voice.filter('lowpass', BOOM_RUMBLE_LOWPASS_HZ);
  rumble.connect(output);
  const rumbleNoise = voice.play(voice.buffers.brown, when + BOOM_RUMBLE_DELAY_S, rumble, {
    duration: BOOM_RUMBLE_LENGTH_S * size,
    offset: random(0, BOOM_NOISE_OFFSET_MAX_S),
    rate: BOOM_RUMBLE_RATE,
  });
  decay(rumbleNoise.gain, when + BOOM_RUMBLE_DELAY_S, [
    BOOM_RUMBLE_GAIN,
    BOOM_RUMBLE_ATTACK_S,
    BOOM_RUMBLE_DECAY_S * size,
  ]);
}
