/** Prototype whistle synthesis, with seeded variation and owned Web Audio nodes. */
import { decay } from './voice';
import type { SoundPlayback } from './playback';
// Prototype whistle soft hz, Hz.
const WHISTLE_SOFT_HZ = 1500;
// Prototype whistle min hz, Hz.
const WHISTLE_MIN_HZ = 1100;
// Prototype whistle max hz, Hz.
const WHISTLE_MAX_HZ = 1400;
// Prototype whistle pitch rise, dimensionless acoustic tuning.
const WHISTLE_PITCH_RISE = 1.9;
// Prototype whistle flutter min hz, Hz.
const WHISTLE_FLUTTER_MIN_HZ = 22;
// Prototype whistle flutter max hz, Hz.
const WHISTLE_FLUTTER_MAX_HZ = 30;
// Prototype whistle flutter gain, dimensionless acoustic tuning.
const WHISTLE_FLUTTER_GAIN = 0.025;
// Prototype whistle band centre ratio, dimensionless acoustic tuning.
const WHISTLE_BAND_CENTRE_RATIO = 1.4;
// Prototype whistle band q, dimensionless acoustic tuning.
const WHISTLE_BAND_Q = 2.5;
// Prototype whistle band start ratio, dimensionless acoustic tuning.
const WHISTLE_BAND_START_RATIO = 1.2;
// Prototype whistle band end ratio, dimensionless acoustic tuning.
const WHISTLE_BAND_END_RATIO = 2.4;
// Prototype whistle soft gain, dimensionless acoustic tuning.
const WHISTLE_SOFT_GAIN = 0.05;
// Prototype whistle gain, dimensionless acoustic tuning.
const WHISTLE_GAIN = 0.14;
// Prototype whistle attack s, seconds.
const WHISTLE_ATTACK_S = 0.08;
// Prototype whistle decay s, seconds.
const WHISTLE_DECAY_S = 0.2;
// Prototype whistle hold trim s, seconds.
const WHISTLE_HOLD_TRIM_S = 0.25;
// Prototype whistle breath highpass hz, Hz.
const WHISTLE_BREATH_HIGHPASS_HZ = 3000;
// Prototype whistle breath tail s, seconds.
const WHISTLE_BREATH_TAIL_S = 0.3;
// Prototype whistle noise offset max s, seconds.
const WHISTLE_NOISE_OFFSET_MAX_S = 1.5;
// Prototype whistle tone tail s, seconds.
const WHISTLE_TONE_TAIL_S = 0.4;
// Prototype breath envelope: normalised linear gain, attack/decay/hold trim in seconds.
const WHISTLE_BREATH_GAIN = 0.05;
const WHISTLE_BREATH_ATTACK_S = 0.05;
const WHISTLE_BREATH_DECAY_S = 0.2;
const WHISTLE_BREATH_HOLD_TRIM_S = 0.2;
/** Schedules the whistle voice at playback.when audio seconds; mutates only its owned graph. */
export function playWhistle(playback: SoundPlayback): void {
  const { event, when, output, voice, random } = playback;
  // Pulsed combustion in a tube: a buzzy, harmonic tone that climbs in pitch, with flutter.
  const baseFrequency = event.soft ? WHISTLE_SOFT_HZ : random(WHISTLE_MIN_HZ, WHISTLE_MAX_HZ);
  const tone = voice.own(voice.context.createOscillator());
  tone.type = 'sawtooth';
  tone.frequency.setValueAtTime(baseFrequency, when);
  tone.frequency.exponentialRampToValueAtTime(
    baseFrequency * WHISTLE_PITCH_RISE,
    when + event.duration_s,
  );
  const flutter = voice.own(voice.context.createOscillator());
  const flutterGain = voice.own(voice.context.createGain());
  flutter.frequency.value = random(WHISTLE_FLUTTER_MIN_HZ, WHISTLE_FLUTTER_MAX_HZ);
  flutterGain.gain.value = baseFrequency * WHISTLE_FLUTTER_GAIN;
  flutter.connect(flutterGain).connect(tone.frequency);
  const bandpass = voice.filter(
    'bandpass',
    baseFrequency * WHISTLE_BAND_CENTRE_RATIO,
    WHISTLE_BAND_Q,
  );
  bandpass.frequency.setValueAtTime(baseFrequency * WHISTLE_BAND_START_RATIO, when);
  bandpass.frequency.exponentialRampToValueAtTime(
    baseFrequency * WHISTLE_BAND_END_RATIO,
    when + event.duration_s,
  );
  const toneGain = voice.own(voice.context.createGain());
  decay(toneGain.gain, when, [
    event.soft ? WHISTLE_SOFT_GAIN : WHISTLE_GAIN,
    WHISTLE_ATTACK_S,
    WHISTLE_DECAY_S,
    Math.max(0, event.duration_s - WHISTLE_HOLD_TRIM_S),
  ]);
  tone.connect(bandpass).connect(toneGain).connect(output);
  // Breath: the gas jet under the tone.
  const air = voice.filter('highpass', WHISTLE_BREATH_HIGHPASS_HZ);
  air.connect(output);
  const noise = voice.play(voice.buffers.white, when, air, {
    duration: event.duration_s + WHISTLE_BREATH_TAIL_S,
    loop: true,
    offset: random(0, WHISTLE_NOISE_OFFSET_MAX_S),
  });
  decay(noise.gain, when, [
    WHISTLE_BREATH_GAIN,
    WHISTLE_BREATH_ATTACK_S,
    WHISTLE_BREATH_DECAY_S,
    Math.max(0, event.duration_s - WHISTLE_BREATH_HOLD_TRIM_S),
  ]);
  tone.start(when);
  flutter.start(when);
  voice.source(tone, when + event.duration_s + WHISTLE_TONE_TAIL_S);
  voice.source(flutter, when + event.duration_s + WHISTLE_TONE_TAIL_S);
}
