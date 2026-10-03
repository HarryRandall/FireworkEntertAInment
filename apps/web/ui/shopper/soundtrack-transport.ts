/** One audio origin coordinates play, pause, seek and buffering with a firework viewer. */
const MAX_DRIFT_SECONDS = 0.12; // Perceptual sync tolerance in seconds, chosen below a typical beat interval.
/** Minimal transport surface keeps synchronisation testable without WebGL. */
export interface SoundtrackViewer {
  t: number;
  duration: number;
  playing: boolean;
  play(): void;
  pause(): void;
  seek(time: number): void;
  on(listener: (viewer: SoundtrackViewer) => void): () => void;
}
class AudioTransport {
  private active = true;
  private seeking = false;
  private buffering = false;
  private generation = 0;
  private starting = false;
  private readonly unsubscribe: () => void;
  constructor(
    private readonly viewer: SoundtrackViewer,
    private readonly audio: HTMLAudioElement,
    private readonly onError: () => void,
    private readonly offsetSeconds: number,
  ) {
    this.unsubscribe = viewer.on((state) => {
      this.follow(state);
    });
    audio.addEventListener('waiting', this.waiting);
    audio.addEventListener('canplay', this.ready);
    audio.addEventListener('ended', this.ended);
    audio.addEventListener('error', this.failed);
  }
  private follow(state: SoundtrackViewer) {
    if (!this.active || this.seeking) return;
    if (!state.playing) {
      if (!this.buffering) this.audio.pause();
      return;
    }
    const audioTime = state.t + this.offsetSeconds;
    if (audioTime < 0) return; // A negative offset leaves a silent show introduction.
    if (this.audio.paused && !this.starting) {
      this.audio.currentTime = audioTime;
      this.starting = true;
      this.audio
        .play()
        .then(() => {
          this.starting = false;
          if (!this.active || !this.viewer.playing) this.audio.pause();
        })
        .catch(() => {
          this.starting = false;
          if (this.active) this.failed();
        });
      return;
    }
    // Follow the audible clock, including when decoded audio stalls or has drifted.
    if (Math.abs(audioTime - this.audio.currentTime) > MAX_DRIFT_SECONDS) {
      this.seeking = true;
      this.viewer.seek(this.audio.currentTime - this.offsetSeconds);
      this.seeking = false;
    }
  }

  private readonly waiting = () => {
    if (this.viewer.playing) {
      this.buffering = true;
      this.viewer.pause();
    }
  };
  private readonly ready = () => {
    if (this.active && this.buffering) {
      this.buffering = false;
      this.viewer.play();
    }
  };
  private readonly ended = () => {
    this.buffering = false;
    this.viewer.pause();
  };
  private readonly failed = () => {
    this.buffering = false;
    this.viewer.pause();
    this.onError();
  };
  async toggle() {
    if (this.viewer.playing || this.buffering || this.starting) {
      this.generation += 1;
      this.buffering = false;
      this.starting = false;
      this.viewer.pause();
      this.audio.pause();
      return;
    }
    await this.start();
  }
  private async start() {
    const attempt = ++this.generation;
    const showTime = this.viewer.t >= this.viewer.duration ? 0 : this.viewer.t;
    const audioTime = showTime + this.offsetSeconds;
    if (audioTime < 0) {
      this.viewer.play();
      return;
    }
    this.audio.currentTime = audioTime;
    this.starting = true;
    try {
      await this.audio.play();
      if (attempt === this.generation) this.starting = false;
      if (this.active && attempt === this.generation) this.viewer.play();
      else this.audio.pause();
    } catch {
      if (attempt === this.generation) this.starting = false;
      if (this.active && attempt === this.generation) this.failed();
    }
  }
  seek(seconds: number) {
    const showTime = Math.max(0, Math.min(this.viewer.duration, seconds));
    this.audio.currentTime = Math.max(0, showTime + this.offsetSeconds);
    if (showTime + this.offsetSeconds < 0) this.audio.pause();
    this.seeking = true;
    this.viewer.seek(showTime);
    this.seeking = false;
  }
  dispose() {
    this.active = false;
    this.generation += 1;
    this.unsubscribe();
    this.audio.pause();
    this.audio.removeEventListener('waiting', this.waiting);
    this.audio.removeEventListener('canplay', this.ready);
    this.audio.removeEventListener('ended', this.ended);
    this.audio.removeEventListener('error', this.failed);
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
/** Binds audio and viewer in seconds from show start, with an audio offset; disposes all listeners.
 * Positive offsets trim audio; negative offsets delay it. Audio is the playback clock. The viewer waits for audio and follows it within 120 ms. */
export function soundtrackTransport(
  viewer: SoundtrackViewer,
  audio: HTMLAudioElement,
  onError: () => void,
  offsetSeconds = 0,
) {
  if (!Number.isFinite(offsetSeconds)) throw new RangeError('Audio offset must be finite seconds');
  return new AudioTransport(viewer, audio, onError, offsetSeconds);
}
