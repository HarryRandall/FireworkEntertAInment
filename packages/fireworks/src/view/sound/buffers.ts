/** Seeded noise, shock fronts and outdoor reflections, synthesised without audio assets. */
import { hash } from '../../sim/random';
/** Shared mono waveforms and stereo outdoor impulse for one owned AudioContext. */
export interface SoundBuffers {
  white: AudioBuffer;
  brown: AudioBuffer;
  nwave: AudioBuffer;
  pop: AudioBuffer;
  echo: AudioBuffer;
}
// Prototype buffer lengths, in seconds; N-wave front and crackle decay model short pressure pulses.
const WHITE_S = 2;
const BROWN_S = 3;
const NWAVE_S = 0.03;
const SHOCK_S = 0.012;
const SHOCK_TAIL_S = 0.002;
const SHOCK_TAIL_GAIN = 0.4;
const POP_S = 0.006;
const POP_DECAY_S = 0.0012;
// Prototype brown-noise integrator coefficients and amplitude, dimensionless.
const BROWN_STEP = 0.02;
const BROWN_DAMPING = 1.02;
const BROWN_GAIN = 3.5;
// Prototype outdoor echo: seconds and dimensionless low-pass/level tuning.
const ECHO_S = 3;
const ECHO_LOWPASS = 0.08;
const ECHO_DECAY_S = 0.7;
const ECHO_GAIN = 0.9;
const ECHO_STEREO_S = 0.013;
const REFLECTION_WIDTH_S = 0.05;
const REFLECTION_DECAY_S = 0.012;
// Prototype reflection arrivals (seconds) and levels (linear gain).
const FIRST_REFLECTION_S = 0.18;
const FIRST_REFLECTION_GAIN = 0.5;
const SECOND_REFLECTION_S = 0.43;
const SECOND_REFLECTION_GAIN = 0.35;
const THIRD_REFLECTION_S = 0.71;
const THIRD_REFLECTION_GAIN = 0.25;
const FOURTH_REFLECTION_S = 1.1;
const FOURTH_REFLECTION_GAIN = 0.16;
const REFLECTIONS = [
  [FIRST_REFLECTION_S, FIRST_REFLECTION_GAIN],
  [SECOND_REFLECTION_S, SECOND_REFLECTION_GAIN],
  [THIRD_REFLECTION_S, THIRD_REFLECTION_GAIN],
  [FOURTH_REFLECTION_S, FOURTH_REFLECTION_GAIN],
] as const;
// Independent fixed waveform streams; event variation has a separate seeded stream.
const WHITE_STREAM = 101;
const BROWN_STREAM = 102;
const POP_STREAM = 103;
const ECHO_STREAM = 104;
const REFLECTION_STREAM = 105;
function noise(index: number, stream: number): number {
  return hash(index, stream, 0) * 2 - 1;
}
function mono(context: AudioContext, seconds: number): AudioBuffer {
  return context.createBuffer(
    1,
    Math.max(1, Math.floor(context.sampleRate * seconds)),
    context.sampleRate,
  );
}
function noiseBuffers(context: AudioContext): Pick<SoundBuffers, 'white' | 'brown' | 'pop'> {
  const white = mono(context, WHITE_S);
  const brown = mono(context, BROWN_S);
  const pop = mono(context, POP_S);
  white.getChannelData(0).forEach((_, index, data) => {
    data[index] = noise(index, WHITE_STREAM);
  });
  let last = 0;
  brown.getChannelData(0).forEach((_, index, data) => {
    last = (last + BROWN_STEP * noise(index, BROWN_STREAM)) / BROWN_DAMPING;
    data[index] = last * BROWN_GAIN;
  });
  pop.getChannelData(0).forEach((_, index, data) => {
    data[index] = noise(index, POP_STREAM) * Math.exp(-index / (context.sampleRate * POP_DECAY_S));
  });
  return { white, brown, pop };
}
function shockBuffer(context: AudioContext): AudioBuffer {
  const buffer = mono(context, NWAVE_S);
  const front = Math.floor(context.sampleRate * SHOCK_S);
  buffer.getChannelData(0).forEach((_, index, data) => {
    // N-shaped pressure front crosses zero, then relaxes exponentially after the snap.
    data[index] =
      index < front
        ? 1 - (2 * index) / front
        : -Math.exp(-(index - front) / (context.sampleRate * SHOCK_TAIL_S)) * SHOCK_TAIL_GAIN;
  });
  return buffer;
}
function echoBuffer(context: AudioContext): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.floor(rate * ECHO_S);
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let lowpass = 0;
    for (let index = 0; index < length; index++) {
      lowpass += (noise(index, ECHO_STREAM + channel) - lowpass) * ECHO_LOWPASS;
      data[index] = lowpass * Math.exp(-index / rate / ECHO_DECAY_S) * ECHO_GAIN;
    }
    for (const [arrival, gain] of REFLECTIONS) {
      const offset = Math.floor((arrival + channel * ECHO_STEREO_S) * rate);
      for (let index = 0; index < rate * REFLECTION_WIDTH_S && offset + index < length; index++) {
        data[offset + index] =
          (data[offset + index] ?? 0) +
          gain *
            noise(index + offset, REFLECTION_STREAM + channel) *
            Math.exp(-index / (rate * REFLECTION_DECAY_S));
      }
    }
  }
  return buffer;
}
/** Allocates prototype waveforms at context.sampleRate Hz; ownership stays with this context. */
export function makeSoundBuffers(context: AudioContext): SoundBuffers {
  return { ...noiseBuffers(context), nwave: shockBuffer(context), echo: echoBuffer(context) };
}
