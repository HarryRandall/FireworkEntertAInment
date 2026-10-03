/** One playback voice owns dry audio, generated echoes and all transient nodes. */
import type { SoundBuffers } from './buffers';
// Prototype echo mix and compressor calibration: linear gain, dB, ratio and seconds.
const ECHO_MIX = 0.55;
const COMPRESSOR_THRESHOLD_DB = -14;
const COMPRESSOR_RATIO = 6;
const COMPRESSOR_ATTACK_S = 0.002;
const COMPRESSOR_RELEASE_S = 0.25;
// Prototype distance absorption and echo-send calibration, metres, Hz and linear gains.
const MIN_CUTOFF_HZ = 700;
const NEAR_CUTOFF_HZ = 16000;
const ABSORPTION_M = 140;
const MAX_ECHO_SEND = 0.9;
const NEAR_ECHO_SEND = 0.25;
const ECHO_DISTANCE_M = 250;
// Positive floor permits exponential gain envelopes; prototype default filter resonance.
const ENVELOPE_FLOOR = 0.0001;
const FILTER_Q = 0.7;
// Prototype bus retention: at least eight seconds or the sustained voice plus four echo seconds.
const MIN_BUS_TAIL_S = 8;
const ECHO_TAIL_S = 4;
// Converts audio-clock seconds to the browser timer's milliseconds.
const MS_PER_S = 1000;
/** Voice-local node ownership and waveform primitives; all times use AudioContext seconds. */
export class SoundVoice {
  readonly output: GainNode;
  private readonly echo: ConvolverNode;
  private readonly nodes = new Set<AudioNode>();
  private eventEnd_s = 0;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly sources = new Set<AudioScheduledSourceNode>();
  /** Creates an isolated dry/echo graph; volume is a normalised linear gain. */
  constructor(
    readonly context: AudioContext,
    readonly buffers: SoundBuffers,
    volume: number,
  ) {
    this.output = this.own(context.createGain());
    this.output.gain.value = volume;
    const compressor = this.own(context.createDynamicsCompressor());
    compressor.threshold.value = COMPRESSOR_THRESHOLD_DB;
    compressor.ratio.value = COMPRESSOR_RATIO;
    compressor.attack.value = COMPRESSOR_ATTACK_S;
    compressor.release.value = COMPRESSOR_RELEASE_S;
    this.output.connect(compressor).connect(context.destination);
    this.echo = this.own(context.createConvolver());
    this.echo.buffer = buffers.echo;
    const wet = this.own(context.createGain());
    wet.gain.value = ECHO_MIX;
    this.echo.connect(wet).connect(this.output);
  }
  /** Tracks a node until voice teardown; returns the same node without graph mutation. */
  own<T extends AudioNode>(node: T): T {
    this.nodes.add(node);
    return node;
  }
  /** Tracks scheduled sources, releasing finished nodes; times are audio seconds. */
  source<T extends AudioScheduledSourceNode>(node: T, end_s: number): T {
    this.own(node);
    this.sources.add(node);
    node.onended = () => {
      this.sources.delete(node);
      this.nodes.delete(node);
      node.disconnect();
    };
    this.eventEnd_s = Math.max(this.eventEnd_s, end_s);
    node.stop(end_s);
    return node;
  }
  /** Builds one event bus with metre distance absorption and centred echo, returning its input. */
  bus(gain: number, distance_m: number, pan: number): BiquadFilterNode {
    const lowpass = this.filter(
      'lowpass',
      Math.max(MIN_CUTOFF_HZ, NEAR_CUTOFF_HZ * Math.exp(-distance_m / ABSORPTION_M)),
    );
    const level = this.own(this.context.createGain());
    level.gain.value = gain;
    const send = this.own(this.context.createGain());
    send.gain.value = Math.min(MAX_ECHO_SEND, NEAR_ECHO_SEND + distance_m / ECHO_DISTANCE_M);
    const panner = this.own(this.context.createStereoPanner());
    panner.pan.value = pan;
    lowpass.connect(level);
    level.connect(panner).connect(this.output);
    level.connect(send).connect(this.echo);
    return lowpass;
  }
  /** Creates an owned Hz filter with dimensionless resonance and no connection. */
  filter(type: BiquadFilterType, frequency_hz: number, q = FILTER_Q): BiquadFilterNode {
    const filter = this.own(this.context.createBiquadFilter());
    filter.type = type;
    filter.frequency.value = frequency_hz;
    filter.Q.value = q;
    return filter;
  }
  /** Starts a buffer at audio seconds, with optional duration, offset, gain and playback multiplier. */
  play(
    buffer: AudioBuffer,
    when: number,
    output: AudioNode,
    options: BufferOptions = {},
  ): GainNode {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;
    source.loop = options.loop ?? false;
    const gain = this.own(this.context.createGain());
    gain.gain.value = options.gain ?? 1;
    source.connect(gain).connect(output);
    source.start(when, options.offset ?? 0);
    this.source(source, when + (options.duration ?? buffer.duration / source.playbackRate.value));
    return gain;
  }
  /** Retains only this event's transient nodes through its dry/echo tail, then disconnects them. */
  event(schedule: () => void, when_s: number, duration_s: number): void {
    const previous = new Set(this.nodes);
    this.eventEnd_s = when_s;
    schedule();
    const nodes = [...this.nodes].filter((node) => !previous.has(node));
    const delay =
      Math.max(0, when_s - this.context.currentTime) +
      Math.max(MIN_BUS_TAIL_S, duration_s + ECHO_TAIL_S, this.eventEnd_s - when_s + ECHO_TAIL_S);
    const timer = setTimeout(() => {
      for (const node of nodes) {
        node.disconnect();
        this.nodes.delete(node);
      }
      this.timers.delete(timer);
    }, delay * MS_PER_S);
    this.timers.add(timer);
  }
  /** Silences dry and echo immediately, stops pending sources and disconnects the whole voice. */
  hush(): void {
    this.output.gain.cancelScheduledValues(this.context.currentTime);
    this.output.gain.setValueAtTime(0, this.context.currentTime);
    for (const source of this.sources) source.stop();
    for (const node of this.nodes) node.disconnect();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.sources.clear();
    this.nodes.clear();
  }
}
/** Buffer controls: durations and offsets in seconds, gain/rate normalised multipliers. */
interface BufferOptions {
  rate?: number;
  gain?: number;
  loop?: boolean;
  duration?: number;
  offset?: number;
}
/** Programs a positive exponential attack/hold/decay envelope in audio seconds and linear gain. */
export function decay(
  param: AudioParam,
  when: number,
  envelope: readonly [number, number, number, number?],
): void {
  const [peak, attack, time, hold = 0] = envelope;
  param.setValueAtTime(ENVELOPE_FLOOR, when);
  param.exponentialRampToValueAtTime(Math.max(ENVELOPE_FLOOR, peak), when + attack);
  if (hold > 0) param.setValueAtTime(peak, when + attack + hold);
  param.exponentialRampToValueAtTime(ENVELOPE_FLOOR, when + attack + hold + time);
}
