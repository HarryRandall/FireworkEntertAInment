/** Small Web Audio graph double: records parameters, routing and scheduled source lifetimes. */
/** Records AudioParam values and automation without evaluating DSP. */
export class Param {
  value = 1;
  calls = [];
  setValueAtTime(value, time) {
    this.value = value;
    this.calls.push(['set', value, time]);
  }
  exponentialRampToValueAtTime(value, time) {
    this.calls.push(['exponential', value, time]);
  }
  cancelScheduledValues(time) {
    this.calls.push(['cancel', time]);
  }
}
/** Records graph connections and source starts/stops for lifecycle assertions. */
export class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  pan = new Param();
  threshold = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  playbackRate = new Param();
  connections = [];
  disconnected = false;
  starts = [];
  stops = [];
  constructor(kind) {
    this.kind = kind;
  }
  connect(target) {
    this.connections.push(target);
    return target;
  }
  disconnect() {
    this.connections = [];
    this.disconnected = true;
  }
  start(...args) {
    this.starts.push(args);
  }
  stop(...args) {
    this.stops.push(args);
  }
}
/** Records graph construction without producing audio; sample rate is a cheap test-only 1 kHz. */
export class AudioContext {
  static instances = [];
  sampleRate = 1000;
  currentTime = 10;
  state = 'suspended';
  nodes = [];
  destination = new Node('destination');
  constructor() {
    AudioContext.instances.push(this);
  }
  createBuffer(channels, length, rate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      duration: length / rate,
      length,
      sampleRate: rate,
      numberOfChannels: channels,
      getChannelData: (channel) => data[channel],
    };
  }
  make(kind) {
    const node = new Node(kind);
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this.make('gain');
  }
  createBiquadFilter() {
    return this.make('filter');
  }
  createDynamicsCompressor() {
    return this.make('compressor');
  }
  createConvolver() {
    return this.make('convolver');
  }
  createStereoPanner() {
    return this.make('panner');
  }
  createBufferSource() {
    return this.make('buffer');
  }
  createOscillator() {
    return this.make('oscillator');
  }
  async resume() {
    this.state = 'running';
  }
  async close() {
    this.state = 'closed';
    this.closed = true;
  }
}
