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
// Prototype maximum catch-up after gesture resume, in sequence seconds.
const MAX_UNLOCK_CATCHUP_S = 0.6;
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
      this.reset(0);
      from = 0;
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
  private crossed(event: SoundEvent, from_s: number, to_s: number): boolean {
    const startsHere = event.time_s === from_s && this.includeStart;
    return (event.time_s > from_s || startsHere) && event.time_s <= to_s;
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
    for (const event of this.cues()) {
      if (this.crossed(event, from, interval.to_s)) this.scheduleEvent(event, interval);
    }
    this.includeStart = false;
  }
  private cues(): readonly SoundEvent[] {
    this.events ??= soundEvents(this.shots);
    return this.events;
  }
  private takeStart(interval: SoundInterval): number {
    const held = this.heldFrom;
    const start =
      held !== null && interval.to_s - held < MAX_UNLOCK_CATCHUP_S ? held : interval.from_s;
    this.heldFrom = null;
    return start;
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
