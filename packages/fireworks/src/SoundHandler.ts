/**
 * Plays the per-shell sound effects (mortar lift, boom, crackle).
 *
 * Each {@link SoundKey} maps to a small bank of audio files; a seeded pick
 * keeps repeated bursts from sounding identical. Sound owns its own random
 * stream: whether audio is muted, loaded or playing must never change the
 * numbers that lay out stars.
 */
import * as THREE from 'three';
import { createSeededRng } from './random.ts';

export type SoundKey = 'mortar' | 'lightBoom' | 'heavyBoom' | 'crackle';
export type SoundAssets = Record<SoundKey, readonly string[]>;

export class SoundHandler {
  readonly listener: THREE.AudioListener;
  private buffers: Record<SoundKey, AudioBuffer[]> = {
    mortar: [],
    lightBoom: [],
    heavyBoom: [],
    crackle: [],
  };
  private muted = false;
  private loaded = false;
  private playbackPaused = false;
  private readonly random = createSeededRng(0x50_4e_44);

  constructor(
    private readonly assets: SoundAssets = {
      mortar: [],
      lightBoom: [],
      heavyBoom: [],
      crackle: [],
    },
  ) {
    this.listener = new THREE.AudioListener();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    const loader = new THREE.AudioLoader();
    const tasks: Promise<void>[] = [];
    (Object.keys(this.assets) as SoundKey[]).forEach((key) => {
      this.assets[key].forEach((path) => {
        tasks.push(
          new Promise<void>((resolve) => {
            loader.load(
              path,
              (buffer) => {
                this.buffers[key].push(buffer);
                resolve();
              },
              undefined,
              () => resolve(),
            );
          }),
        );
      });
    });
    await Promise.all(tasks);
    this.loaded = true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * Freeze or unfreeze in-flight effect sounds by suspending the shared
   * AudioContext. Pausing the show cuts booms/crackles off immediately and
   * resuming plays their remainder, keeping effect audio in step with the
   * paused timeline. While paused, `resume()` is a no-op so the audio-unlock
   * gesture handlers cannot un-suspend the context mid-pause.
   */
  setPlaybackPaused(paused: boolean): void {
    if (this.playbackPaused === paused) return;
    this.playbackPaused = paused;
    const context = this.listener.context;
    if (paused) {
      if (context.state === 'running') void context.suspend().catch(() => undefined);
    } else if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
  }

  async resume(): Promise<void> {
    if (this.playbackPaused) return;
    const context = this.listener.context;
    if (context.state === 'suspended') {
      await context.resume().catch(() => undefined);
    }
  }

  playRandomMortar(volume = 1): void {
    this.playRandom('mortar', volume);
  }

  playRandomLightBoom(volume = 1): void {
    this.playRandom('lightBoom', volume);
  }

  playRandomHeavyBoom(volume = 1): void {
    this.playRandom('heavyBoom', volume);
  }

  playRandomCrackle(volume = 0.1): void {
    this.playRandom('crackle', volume);
  }

  /** Chance roll for optional sounds, drawn from the sound stream. */
  chance(probability: number): boolean {
    return this.random.next() < probability;
  }

  private playRandom(key: SoundKey, volume: number): void {
    // Nothing new should start while paused; a suspended context would queue
    // it silently and blast it on resume.
    if (this.muted || this.playbackPaused) return;
    void this.resume();
    const pool = this.buffers[key];
    if (!pool.length) return;
    const buffer = pool[Math.floor(this.random.next() * pool.length)];
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(buffer);
    sound.setLoop(false);
    sound.setVolume(volume);
    sound.play();
  }
}
