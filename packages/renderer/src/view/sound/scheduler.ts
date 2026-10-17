/** Browser audio transport: gesture unlock, sequence-to-audio timing and isolated teardown. */
import { soundEvents, soundDistance, type SoundShot, type SoundEvent } from '../../sim/events';
import { soundLag } from '../../sim/shake';
import type { Vec3 } from '../../sim/colour';
import { SETTINGS } from '../settings';
import { makeSoundBuffers, type SoundBuffers } from './buffers';
import { SoundVoice } from './voice';
import { playSound } from './playback';
import type { Viewer } from '../viewer';
// Prototype distance attenuation: reference metres and minimum normalised gain.
const REFERENCE_M = 90;
const MIN_GAIN = 0.15;
// Prototype stereo width, normalised pan; echoes remain centred.
const PAN_WIDTH = 0.8;
// Maximum catch-up after a gesture resume or a stalled frame, in sequence seconds. Anything
// older is skipped instead of being fired at once, so a long frame never bursts the backlog.
const MAX_CATCHUP_S = 0.6;
// A backward move into the opening is a loop or restart and replays the zero lift; any other
// backward move is a seek and stays silent until the next forward tick.
const RESTART_WINDOW_S = 0.6;
/**
 * Bounded audio load: cues scheduled per second of sequence time and per forward tick. A dense
 * finale can cross far more cues than the audio thread can mix; the loudest and nearest keep
 * their voices and the rest are dropped deterministically, which protects both the effect mix
 * and any soundtrack sharing the output device.
 */
export const MAX_CUES_PER_SECOND = 16;
export const MAX_CUES_PER_TICK = 8;
const LOAD_WINDOW_S = 1;
// Relative perceptual priorities for retaining the clearest cues under load.
const BOOM_PRIORITY = 4;
const LOUD_PRIORITY = 3;
const MAX_DISTANCE_PENALTY = 3;
/** A forward sequence interval, in seconds; listener/right are unshaken world-space vectors. */
export interface SoundInterval {
  from_s: number;
  to_s: number;
  speed: number;
  listener: Vec3;
  right: Vec3;
}
/** Owns one viewer's lazily unlocked AudioContext, cues and current playback voice. */
export class ViewerSound {
  private context: AudioContext | null = null;
  private buffers: SoundBuffers | null = null;
  private voice: SoundVoice | null = null;
  private shots: readonly SoundShot[] = [];
  private events: SoundEvent[] | null = null;
  private disposed = false;
  private includeStart = true;
  private cursor_s = 0;
  private readonly listener: Vec3 = [0, 0, 0];
  private readonly right: Vec3 = [1, 0, 0];
  private heldFrom: number | null = null;
  /** Sequence times of recently scheduled cues, oldest first, for the load window. */
  private recent: number[] = [];
  private readonly abort = new AbortController();
  /** Registers scoped gesture unlock after the view mounts successfully; never creates audio. */
  listen(): void {
    if (this.disposed) return;
    // Bubble after the unmute control changes the preference in this same gesture.
    for (const name of ['pointerdown', 'keydown', 'click']) {
      document.addEventListener(name, this.gesture, { signal: this.abort.signal });
    }
  }
  private gesture = (): void => {
    if (this.disposed || !SETTINGS.sound || SETTINGS.volume === 0) return;
    try {
      if (!this.context) {
        const Context = window.AudioContext;
        if (typeof Context === 'undefined') return;
        this.context = new Context();
      }
      this.buffers ??= makeSoundBuffers(this.context);
      // Only this gesture may resume audio; readiness and preference updates never wait for it.
      if (this.context.state === 'suspended') {
        this.context.resume().catch((cause: unknown) => {
          console.warn('Could not resume firework audio', cause);
        });
      }
      this.configure();
    } catch (cause) {
      console.warn('Could not initialise firework audio', cause);
    }
  };
  /** Applies browser-wide mute/volume; remembered sound still requires a gesture in this page. */
  configure(): void {
    if (this.disposed) return;
    if (!SETTINGS.sound || SETTINGS.volume === 0) {
      this.hush();
      return;
    }
    if (!this.context) return;
    try {
      this.voice?.output.gain.setValueAtTime(SETTINGS.volume, this.context.currentTime);
    } catch (cause) {
      console.warn('Could not update firework audio volume', cause);
    }
  }
  /** Retains stored shots without resolving cues or buffers; audible playback resolves them lazily. */
  setShots(shots: readonly SoundShot[]): void {
    this.hush();
    this.shots = shots;
    this.events = null;
  }
  /** Resets audio on an explicit transport discontinuity; zero includes the first mortar lift once. */
  reset(time_s: number): void {
    this.hush();
    this.includeStart = time_s === 0;
    this.cursor_s = time_s;
    this.recent = [];
  }
  /** Samples the unshaken camera and forwards only real playback intervals, never paused redraws. */
  frame(viewer: Viewer): void {
    const previous = this.cursor_s;
    this.cursor_s = viewer.t;
    if (!viewer.playing) {
      this.hush();
      return;
    }
    if (!this.ready()) return;
    let from = previous;
    if (viewer.t < previous) {
      const restart = viewer.t <= RESTART_WINDOW_S;
      this.reset(restart ? 0 : viewer.t);
      from = restart ? 0 : viewer.t;
      this.cursor_s = viewer.t;
    }
    viewer.camera.position.toArray(this.listener);
    const matrix = viewer.camera.matrixWorld.elements;
    this.right[0] = matrix[0];
    this.right[1] = matrix[1];
    this.right[2] = matrix[2];
    try {
      this.advance({
        from_s: from,
        to_s: viewer.t,
        speed: viewer.speed,
        listener: this.listener,
        right: this.right,
      });
    } catch (cause) {
      console.warn('Could not schedule firework audio', cause);
      this.hush();
    }
  }
  private ready(): boolean {
    return (
      SETTINGS.sound &&
      SETTINGS.volume > 0 &&
      this.context !== null &&
      this.buffers !== null &&
      !this.disposed
    );
  }
  /** Schedules only crossed cues while playing forwards; lag and sustained lengths stretch with speed. */
  advance(interval: SoundInterval): void {
    const context = this.context;
    if (!this.ready() || !context || !this.buffers) return;
    if (context.state === 'suspended') {
      this.heldFrom ??= interval.from_s;
      return;
    }
    if (context.state !== 'running' || interval.to_s <= interval.from_s) return;
    const from = this.takeStart(interval);
    this.ensureVoice(context, this.buffers);
    for (const event of this.select(this.crossing(from, interval.to_s), interval)) {
      this.scheduleEvent(event, interval);
    }
    this.includeStart = false;
  }
  private cues(): readonly SoundEvent[] {
    this.events ??= soundEvents(this.shots);
    return this.events;
  }
  /**
   * The interval start after a held resume or a stalled frame: at most the trailing catch-up
   * window is replayed, so the opening lift at zero survives only when playback is still near it.
   */
  private takeStart(interval: SoundInterval): number {
    const held = this.heldFrom;
    this.heldFrom = null;
    const start = held !== null && held < interval.from_s ? held : interval.from_s;
    return Math.max(start, interval.to_s - MAX_CATCHUP_S);
  }
  /** Cues inside (from, to], or [from, to] on a fresh start; cues are sorted so this is a search. */
  private crossing(from_s: number, to_s: number): SoundEvent[] {
    const events = this.cues();
    const crossed: SoundEvent[] = [];
    for (let index = firstCueAfter(events, from_s, this.includeStart && from_s === 0); ; index++) {
      const event = events[index];
      if (event === undefined || event.time_s > to_s) return crossed;
      crossed.push(event);
    }
  }
  /** Keeps the cues the load budget allows, loudest and nearest first, in time order. */
  private select(crossed: SoundEvent[], interval: SoundInterval): SoundEvent[] {
    const windowStart = interval.to_s - LOAD_WINDOW_S;
    this.recent = this.recent.filter((time) => time > windowStart);
    const budget = Math.min(MAX_CUES_PER_TICK, MAX_CUES_PER_SECOND - this.recent.length);
    if (budget <= 0) return [];
    if (crossed.length <= budget) {
      for (const event of crossed) this.recent.push(event.time_s);
      return crossed;
    }
    const ranked = crossed
      .map((event, index) => ({
        event,
        index,
        priority: cuePriority(event, soundDistance(event, interval.listener)),
      }))
      .sort((left, right) => {
        const priorityDifference = right.priority - left.priority;
        return priorityDifference !== 0 ? priorityDifference : left.index - right.index;
      })
      .slice(0, budget)
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.event);
    for (const event of ranked) this.recent.push(event.time_s);
    this.recent.sort((left, right) => left - right);
    return ranked;
  }
  private ensureVoice(context: AudioContext, buffers: SoundBuffers): void {
    this.voice ??= new SoundVoice(context, buffers, SETTINGS.volume);
  }
  private scheduleEvent(event: SoundEvent, interval: SoundInterval): void {
    const voice = this.voice;
    if (!voice) return;
    const distance = soundDistance(event, interval.listener);
    const gain = Math.max(MIN_GAIN, Math.min(1, REFERENCE_M / Math.max(1, distance)));
    const displacement: Vec3 = [
      event.position[0] - interval.listener[0],
      event.position[1] - interval.listener[1],
      event.position[2] - interval.listener[2],
    ];
    const side =
      (interval.right[0] * displacement[0] +
        interval.right[1] * displacement[1] +
        interval.right[2] * displacement[2]) /
      Math.max(1, distance);
    const pan = Math.max(-PAN_WIDTH, Math.min(PAN_WIDTH, side * PAN_WIDTH));
    const when = voice.context.currentTime + soundLag(distance) / interval.speed;
    const stretched = { ...event, duration_s: event.duration_s / interval.speed };
    voice.event(
      () => {
        const output = voice.bus(gain, distance, pan);
        playSound({ event: stretched, when, output, voice });
      },
      when,
      stretched.duration_s,
    );
  }
  /** Immediately stops scheduled sources and disconnects dry and echo paths; context stays reusable. */
  hush(): void {
    this.heldFrom = null;
    const voice = this.voice;
    this.voice = null;
    try {
      voice?.hush();
    } catch (cause) {
      console.warn('Could not silence firework audio', cause);
    }
  }
  /** Removes unlock listeners and closes the owned context; close failures remain visible. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.hush();
    try {
      this.context?.close().catch((cause: unknown) => {
        console.warn('Could not close firework audio', cause);
      });
    } catch (cause) {
      console.warn('Could not close firework audio', cause);
    }
    this.context = null;
    this.buffers = null;
  }
}
/** Index of the first chronological cue after `from_s` (or at it, when the start is included). */
function firstCueAfter(events: readonly SoundEvent[], from_s: number, inclusive: boolean): number {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const time = events[middle]?.time_s ?? Infinity;
    if (time < from_s || (time === from_s && !inclusive)) low = middle + 1;
    else high = middle;
  }
  return low;
}
/**
 * Which cues survive an overloaded tick: breaks and heavy crackle before lifts and air, loud before
 * soft, then nearer sources first. Pure, so culling is reproducible for the same frame timings.
 */
export function cuePriority(
  event: Pick<SoundEvent, 'kind' | 'loud' | 'heavy' | 'quiet' | 'soft' | 'size'>,
  distance_m: number,
): number {
  let priority = 0;
  if (event.kind === 'boom') priority = BOOM_PRIORITY;
  else if (event.kind === 'lift') priority = 2;
  if (event.loud) priority += LOUD_PRIORITY;
  if (event.heavy) priority += 2;
  if (event.soft) priority -= 1;
  if (event.quiet) priority -= 2;
  priority += Math.min(2, Math.max(0, event.size - 1));
  return priority - Math.min(MAX_DISTANCE_PENALTY, distance_m / REFERENCE_M);
}
