/**
 * Soundtrack-owned replay transport.
 *
 * On a show with a soundtrack the media element is the only clock: the
 * fireworks never run ahead on a wall clock while the music is paused,
 * buffering or broken. Whatever stops the media (the browser losing audio
 * focus, a system media key, an expired signed URL) stops the show at the
 * same instant, and Play resumes both from there. The controller is pure so
 * the lifecycle can be exercised without a browser.
 */

export type SoundtrackMedia = Pick<
  HTMLMediaElement,
  | 'paused'
  | 'ended'
  | 'currentTime'
  | 'readyState'
  | 'error'
  | 'play'
  | 'pause'
  | 'addEventListener'
  | 'removeEventListener'
>;

/** Enough buffered data to keep playing; below this the browser is stalled on the network. */
const HAVE_FUTURE_DATA = 3;
// Seeking the element for tiny differences forces a decode for no audible gain.
const SEEK_TOLERANCE_S = 0.1;

export type SoundtrackInterruptionReason =
  | 'paused'
  | 'error'
  | 'ended'
  | 'detached'
  | 'start-failed';

export type SoundtrackInterruption = {
  reason: SoundtrackInterruptionReason;
  /** Media time the show froze at, so the transport and engine agree. */
  time: number;
  error?: unknown;
};

/** Why the media is not running when it should be. */
type StopReason = Exclude<SoundtrackInterruptionReason, 'start-failed'>;

export type SoundtrackClock =
  /** Media is advancing; drive the show from `time`. */
  | { state: 'running'; time: number }
  /** Media is not paused but starved of data; hold the show at `time`. */
  | { state: 'buffering'; time: number }
  /** Media stopped without us asking; the show must stop at `time`. */
  | { state: 'interrupted'; time: number; reason: StopReason };

const MEDIA_EVENTS = ['pause', 'playing', 'waiting', 'timeupdate', 'error'] as const;

/** What to tell the user when the show stopped with its soundtrack. Play is always the way back. */
export function soundtrackInterruptionMessage(reason: SoundtrackInterruptionReason): string {
  switch (reason) {
    case 'paused':
      return 'The soundtrack paused, so the show paused with it. Press Play to carry on from here.';
    case 'error':
      return 'The soundtrack stopped playing. Press Play to try again, or refresh the page if it keeps failing.';
    case 'detached':
      return 'The soundtrack was reloaded. Press Play to carry on from here.';
    case 'start-failed':
      return 'The soundtrack could not start. Try pressing Play again.';
    case 'ended':
      return 'The soundtrack has finished.';
  }
}

function stoppedReason(media: SoundtrackMedia): StopReason | null {
  if (media.error) return 'error';
  if (media.ended) return 'ended';
  if (media.paused) return 'paused';
  return null;
}

export class SoundtrackTransport {
  private media: SoundtrackMedia | null = null;
  private unbind: (() => void) | null = null;
  /** Bumped by every pause, attach and dispose so an older `play()` cannot start playback late. */
  private generation = 0;
  /** True between a play request and our own pause; any stop in between is an interruption. */
  private expectPlaying = false;
  private waiting = false;
  private lastTime = 0;
  private readonly onInterrupted: (interruption: SoundtrackInterruption) => void;

  constructor(onInterrupted: (interruption: SoundtrackInterruption) => void) {
    this.onInterrupted = onInterrupted;
  }

  /** Current media time, falling back to the last finite sample. */
  get time(): number {
    const current = this.media?.currentTime;
    if (current != null && Number.isFinite(current)) this.lastTime = current;
    return this.lastTime;
  }

  get attached(): boolean {
    return this.media !== null;
  }

  /**
   * The user's standing intent: true from a play request until our own pause
   * or an interruption. This, not React state, is what a click toggles, so
   * rapid clicks with a play still pending in the browser land in order.
   */
  get wantsPlayback(): boolean {
    return this.expectPlaying;
  }

  /** Whether the media clock is moving (or about to, with a play request accepted). */
  get running(): boolean {
    const media = this.media;
    return media !== null && !media.paused && !media.ended;
  }

  /** Swaps the media element; a source change mid-play is an interruption, never a silent continue. */
  attach(media: SoundtrackMedia | null): void {
    if (media === this.media) return;
    const previous = this.media;
    const wasExpected = this.expectPlaying;
    const time = this.time;
    this.generation += 1;
    this.unbind?.();
    this.unbind = null;
    this.expectPlaying = false;
    this.waiting = false;
    previous?.pause();
    this.media = media;
    if (media) {
      const handle = (event: Event) => this.handleEvent(event.type);
      for (const name of MEDIA_EVENTS) media.addEventListener(name, handle);
      this.unbind = () => {
        for (const name of MEDIA_EVENTS) media.removeEventListener(name, handle);
      };
    }
    if (wasExpected) this.onInterrupted({ reason: 'detached', time });
  }

  dispose(): void {
    this.pause();
    this.attach(null);
  }

  /** Moves the media without starting it; small differences are left alone. */
  seek(time_s: number): void {
    if (!this.media) return;
    if (Math.abs(this.media.currentTime - time_s) > SEEK_TOLERANCE_S) {
      this.media.currentTime = time_s;
    }
    this.lastTime = time_s;
  }

  /**
   * Starts the media from `from_s`. Must be called synchronously from the
   * user's gesture so the browser's media activation is preserved. Resolves
   * true only when this request is still the current one once the browser
   * has really started playback; a request overtaken by a pause, a new
   * source or disposal resolves false and leaves the media stopped.
   */
  play(from_s: number): Promise<boolean> {
    const media = this.media;
    if (!media) return Promise.resolve(false);
    this.seek(from_s);
    this.generation += 1;
    const generation = this.generation;
    this.expectPlaying = true;
    this.waiting = false;
    return media.play().then(
      () => {
        if (generation === this.generation && media === this.media && this.expectPlaying) {
          return true;
        }
        // The browser honoured a request we have since withdrawn.
        if (!this.expectPlaying || media !== this.media) media.pause();
        return false;
      },
      (error: unknown) => {
        if (generation !== this.generation || media !== this.media) return false;
        this.expectPlaying = false;
        this.onInterrupted({ reason: 'start-failed', time: this.time, error });
        return false;
      },
    );
  }

  /** Our own pause: withdraws any pending play and never counts as an interruption. */
  pause(): void {
    this.generation += 1;
    this.expectPlaying = false;
    this.waiting = false;
    this.media?.pause();
  }

  /**
   * Samples the clock for a frame. Interruptions are detected here as well as
   * from events, so a paused element is caught on the next frame even when
   * the browser never delivered the `pause` event. Each interruption is
   * reported once, through `onInterrupted`, whichever path notices it first.
   */
  sample(): SoundtrackClock {
    const media = this.media;
    const time = this.time;
    if (!media) {
      this.interrupt('detached');
      return { state: 'interrupted', time, reason: 'detached' };
    }
    const stopped = stoppedReason(media);
    if (stopped) {
      this.interrupt(stopped, media.error);
      return { state: 'interrupted', time, reason: stopped };
    }
    if (this.waiting || media.readyState < HAVE_FUTURE_DATA) {
      return { state: 'buffering', time };
    }
    return { state: 'running', time };
  }

  private handleEvent(type: string): void {
    const media = this.media;
    if (!media) return;
    switch (type) {
      case 'waiting':
        this.waiting = true;
        return;
      case 'playing':
      case 'timeupdate':
        this.waiting = false;
        return;
      case 'error':
        this.interrupt('error', media.error);
        return;
      case 'pause':
        this.interrupt(media.ended ? 'ended' : 'paused');
        return;
      default:
        return;
    }
  }

  private interrupt(reason: StopReason, error?: unknown): void {
    if (!this.expectPlaying) return;
    this.expectPlaying = false;
    this.waiting = false;
    this.generation += 1;
    const time = this.time;
    this.onInterrupted(error == null ? { reason, time } : { reason, time, error });
  }
}
