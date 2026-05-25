/**
 * Plays the per-shell sound effects (mortar lift, boom, crackle).
 *
 * Each {@link SoundKey} maps to a small bank of audio files; we round-robin
 * (seeded) through them so repeated bursts don't sound identical. Audio
 * decoding happens lazily — the first call to `play()` for a key warms its
 * AudioBuffers.
 */
import * as THREE from 'three';
import type { RandomSource } from '@/lib/fireworks/random';

const BASE = '/sounds/fireworks';

type SoundKey = 'mortar' | 'lightBoom' | 'heavyBoom' | 'crackle';

const FILES: Record<SoundKey, string[]> = {
  mortar: [`${BASE}/up1.mp3`, `${BASE}/up2.mp3`, `${BASE}/up3.mp3`],
  lightBoom: [`${BASE}/light_boom1.mp3`, `${BASE}/light_boom2.mp3`, `${BASE}/light_boom3.mp3`],
  heavyBoom: [`${BASE}/heavy_boom1.mp3`, `${BASE}/heavy_boom2.mp3`],
  crackle: [`${BASE}/crackle1.mp3`, `${BASE}/crackle2.mp3`],
};

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

  constructor() {
    this.listener = new THREE.AudioListener();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    const loader = new THREE.AudioLoader();
    const tasks: Promise<void>[] = [];
    (Object.keys(FILES) as SoundKey[]).forEach((key) => {
      FILES[key].forEach((path) => {
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

  playRandomMortar(volume = 1, rng?: RandomSource): void {
    this.playRandom('mortar', volume, rng);
  }

  playRandomLightBoom(volume = 1, rng?: RandomSource): void {
    this.playRandom('lightBoom', volume, rng);
  }

  playRandomHeavyBoom(volume = 1, rng?: RandomSource): void {
    this.playRandom('heavyBoom', volume, rng);
  }

  playRandomCrackle(volume = 0.1, rng?: RandomSource): void {
    this.playRandom('crackle', volume, rng);
  }

  private playRandom(key: SoundKey, volume: number, rng?: RandomSource): void {
    if (this.muted) return;
    const pool = this.buffers[key];
    if (!pool.length) return;
    const random = rng?.next() ?? Math.random();
    const buffer = pool[Math.floor(random * pool.length)];
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(buffer);
    sound.setLoop(false);
    sound.setVolume(volume);
    sound.play();
  }
}
