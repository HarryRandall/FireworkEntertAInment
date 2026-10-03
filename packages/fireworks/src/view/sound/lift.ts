/** Prototype lift synthesis, with seeded variation and owned Web Audio nodes. */
import { decay } from './voice';
import type { SoundPlayback } from './playback';
// Prototype lift body lowpass hz, Hz.
const LIFT_BODY_LOWPASS_HZ = 320;
// Prototype lift body length s, seconds.
const LIFT_BODY_LENGTH_S = 0.4;
// Prototype lift noise offset max s, seconds.
const LIFT_NOISE_OFFSET_MAX_S = 1.5;
// Prototype lift quiet body gain, dimensionless acoustic tuning.
const LIFT_QUIET_BODY_GAIN = 1.2;
// Prototype lift body gain, dimensionless acoustic tuning.
const LIFT_BODY_GAIN = 2.2;
// Prototype lift body attack s, seconds.
const LIFT_BODY_ATTACK_S = 0.004;
// Prototype lift body decay s, seconds.
const LIFT_BODY_DECAY_S = 0.2;
// Prototype lift bark min hz, Hz.
const LIFT_BARK_MIN_HZ = 380;
// Prototype lift bark max hz, Hz.
const LIFT_BARK_MAX_HZ = 520;
// Prototype lift bark q, dimensionless acoustic tuning.
const LIFT_BARK_Q = 1.4;
// Prototype lift bark length s, seconds.
const LIFT_BARK_LENGTH_S = 0.15;
// Prototype lift quiet bark gain, dimensionless acoustic tuning.
const LIFT_QUIET_BARK_GAIN = 0.7;
// Prototype lift bark gain, dimensionless acoustic tuning.
const LIFT_BARK_GAIN = 1.3;
// Prototype lift bark attack s, seconds.
const LIFT_BARK_ATTACK_S = 0.002;
// Prototype lift bark decay s, seconds.
const LIFT_BARK_DECAY_S = 0.09;
// Prototype lift tone min hz, Hz.
const LIFT_TONE_MIN_HZ = 95;
// Prototype lift tone max hz, Hz.
const LIFT_TONE_MAX_HZ = 120;
// Prototype lift tone end hz, Hz.
const LIFT_TONE_END_HZ = 48;
// Prototype lift tone slide s, seconds.
const LIFT_TONE_SLIDE_S = 0.12;
// Prototype lift quiet tone gain, dimensionless acoustic tuning.
const LIFT_QUIET_TONE_GAIN = 0.35;
// Prototype lift tone gain, dimensionless acoustic tuning.
const LIFT_TONE_GAIN = 0.6;
// Prototype lift tone attack s, seconds.
const LIFT_TONE_ATTACK_S = 0.003;
// Prototype lift tone decay s, seconds.
const LIFT_TONE_DECAY_S = 0.14;
// Prototype lift tone length s, seconds.
const LIFT_TONE_LENGTH_S = 0.25;
// Prototype lift puff band hz, Hz.
const LIFT_PUFF_BAND_HZ = 700;
// Prototype lift puff q, dimensionless acoustic tuning.
const LIFT_PUFF_Q = 0.8;
// Prototype puff envelope: linear gain, seconds of broadband jet and envelope decay.
const LIFT_PUFF_GAIN = 0.25;
const LIFT_PUFF_LENGTH_S = 0.2;
const LIFT_PUFF_ATTACK_S = 0.002;
const LIFT_PUFF_DECAY_S = 0.12;
/** Schedules the lift voice at playback.when audio seconds; mutates only its owned graph. */
export function playLift(playback: SoundPlayback): void {
  const { event, when, output, voice, random } = playback;
  // Mortar lift: a hollow "thoomp" with a crisp mid-range bark on top, so it carries on small
  // speakers as well as large ones.
  const lowpass = voice.filter('lowpass', LIFT_BODY_LOWPASS_HZ);
  lowpass.connect(output);
  const bodyNoise = voice.play(voice.buffers.brown, when, lowpass, {
    duration: LIFT_BODY_LENGTH_S,
    offset: random(0, LIFT_NOISE_OFFSET_MAX_S),
  });
  decay(bodyNoise.gain, when, [
    event.quiet ? LIFT_QUIET_BODY_GAIN : LIFT_BODY_GAIN,
    LIFT_BODY_ATTACK_S,
    LIFT_BODY_DECAY_S,
  ]);
  const bark = voice.filter('bandpass', random(LIFT_BARK_MIN_HZ, LIFT_BARK_MAX_HZ), LIFT_BARK_Q);
  bark.connect(output);
  const barkNoise = voice.play(voice.buffers.white, when, bark, {
    duration: LIFT_BARK_LENGTH_S,
    offset: random(0, LIFT_NOISE_OFFSET_MAX_S),
  });
  decay(barkNoise.gain, when, [
    event.quiet ? LIFT_QUIET_BARK_GAIN : LIFT_BARK_GAIN,
    LIFT_BARK_ATTACK_S,
    LIFT_BARK_DECAY_S,
  ]);
  const tone = voice.own(voice.context.createOscillator());
  tone.frequency.setValueAtTime(random(LIFT_TONE_MIN_HZ, LIFT_TONE_MAX_HZ), when);
  tone.frequency.exponentialRampToValueAtTime(LIFT_TONE_END_HZ, when + LIFT_TONE_SLIDE_S);
  const toneGain = voice.own(voice.context.createGain());
  decay(toneGain.gain, when, [
    event.quiet ? LIFT_QUIET_TONE_GAIN : LIFT_TONE_GAIN,
    LIFT_TONE_ATTACK_S,
    LIFT_TONE_DECAY_S,
  ]);
  tone.connect(toneGain).connect(output);
  tone.start(when);
  voice.source(tone, when + LIFT_TONE_LENGTH_S);
  const puff = voice.filter('bandpass', LIFT_PUFF_BAND_HZ, LIFT_PUFF_Q);
  puff.connect(output);
  const puffNoise = voice.play(voice.buffers.white, when, puff, {
    duration: LIFT_PUFF_LENGTH_S,
    offset: random(0, LIFT_NOISE_OFFSET_MAX_S),
  });
  decay(puffNoise.gain, when, [LIFT_PUFF_GAIN, LIFT_PUFF_ATTACK_S, LIFT_PUFF_DECAY_S]);
}
