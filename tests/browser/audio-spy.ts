/** Browser-native AudioContext instrumentation for scheduling, silence and navigation cleanup. */
interface AudioRecord {
  starts: number;
  immediateStops: number;
  scheduled: number;
  closed: boolean;
}
declare global {
  interface Window {
    fireworkAudio: AudioRecord[];
  }
}
/** Installs a spy before application code; the browser's real Web Audio graph still runs. */
export function installAudioSpy(): void {
  window.fireworkAudio = [];
  const NativeContext = window.AudioContext;
  class SpyContext extends NativeContext {
    private readonly record: AudioRecord = {
      starts: 0,
      immediateStops: 0,
      scheduled: 0,
      closed: false,
    };
    constructor() {
      super();
      window.fireworkAudio.push(this.record);
    }
    private readonly active = new Set<AudioScheduledSourceNode>();
    private started(source: AudioScheduledSourceNode): void {
      this.record.starts++;
      this.active.add(source);
      this.record.scheduled = this.active.size;
    }
    private track(source: AudioScheduledSourceNode): void {
      const stop = source.stop.bind(source);
      const finished = () => {
        this.active.delete(source);
        this.record.scheduled = this.active.size;
      };
      source.addEventListener('ended', finished, { once: true });
      source.stop = (when?: number) => {
        if (when === undefined || when <= this.currentTime) {
          this.record.immediateStops++;
          finished();
        }
        stop(when);
      };
    }
    override createBufferSource(): AudioBufferSourceNode {
      const source = super.createBufferSource();
      this.track(source);
      const start = source.start.bind(source);
      source.start = (when = 0, offset = 0, duration?: number) => {
        this.started(source);
        start(when, offset, duration);
      };
      return source;
    }
    override createOscillator(): OscillatorNode {
      const oscillator = super.createOscillator();
      this.track(oscillator);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (when?: number) => {
        this.started(oscillator);
        start(when);
      };
      return oscillator;
    }
    override async close(): Promise<void> {
      await super.close();
      this.record.closed = this.state === 'closed';
    }
  }
  window.AudioContext = SpyContext;
}
