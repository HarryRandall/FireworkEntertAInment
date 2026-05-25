/**
 * Top-level Three.js fireworks engine.
 *
 * Owns the scene, particle pool, sound handler, lighting, and the cue
 * scheduler. Mounted by {@link FireworkReplayViewer} on the client; never
 * imported on the server (uses `window`, `THREE`, and `<canvas>`).
 *
 * Lifecycle: call `start(cues)` to bind a list of replay cues to the
 * timeline, then drive `step(currentTime)` from `requestAnimationFrame` or
 * an external clock. `dispose()` must be called on unmount to free GPU
 * resources.
 */
import * as THREE from 'three';
import type { ReplayCue } from '@/lib/show-domain';
import {
  DEFAULT_LAUNCH_POSITIONS,
  type FireworkDesign,
  type LaunchPosition,
  safeParseFireworkDesign,
  scaleDesignForCaliber,
} from '@/lib/fireworks/design';
import { ParticlePool } from '@/lib/fireworks/ParticlePool';
import { SoundHandler } from '@/lib/fireworks/SoundHandler';
import { Lights } from '@/lib/fireworks/Lights';
import { World } from '@/lib/fireworks/World';
import { Effects } from '@/lib/fireworks/Effects';
import { Scheduler } from '@/lib/fireworks/Scheduler';
import { FRAGMENT_SHADER, VERTEX_SHADER } from '@/lib/fireworks/shaders';
import { createSeededRng, mixSeed } from '@/lib/fireworks/random';
import type { Particle } from '@/lib/fireworks/Particle';

type PoolSnapshot = {
  indices: Uint32Array;
  /** packed [x,y,z,vx,vy,vz,life,size,r,g,b,mass,decay,gravity,drag,maxLife] per particle */
  data: Float32Array;
  current: number;
  aliveMax: number;
};

export type FireworksEngineStats = {
  cues: number;
  particles: number;
  scheduledEvents: number;
};

const PARTICLE_CAPACITY = 100_000;
const FIXED_DT = 1 / 60;
// Coarser step for silent rebuilds (scrub/seek). Final state looks the same to
// the eye; cuts physics work ~3x vs 60Hz stepping.
const SCRUB_DT = 1 / 20;
const LARGE_JUMP_SECONDS = 0.35;
const SNAPSHOT_STRIDE = 16;
const MAX_SNAPSHOTS = 120;
const BRIGHTNESS_BOOST = 1.18;

export class FireworksEngine {
  private scene: THREE.Scene;
  private camera: THREE.Camera | null = null;
  private pool: ParticlePool;
  private sound: SoundHandler;
  private lights: Lights;
  private world: World;
  private effects: Effects;
  private scheduler: Scheduler;

  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private points: THREE.Points;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private positionAttribute: THREE.BufferAttribute;
  private colorAttribute: THREE.BufferAttribute;
  private sizeAttribute: THREE.BufferAttribute;

  private elapsed = 0;
  private time = 0;
  /** Snapshots keyed by elapsed seconds, used for fast backward seeks. */
  private snapshots: { time: number; state: PoolSnapshot }[] = [];
  private readonly SNAPSHOT_INTERVAL = 1.0;
  private nextSnapshotAt = 0;

  constructor(scene: THREE.Scene, launchPositions: LaunchPosition[] = DEFAULT_LAUNCH_POSITIONS) {
    this.scene = scene;
    this.pool = new ParticlePool(PARTICLE_CAPACITY);
    this.sound = new SoundHandler();
    void this.sound.load();
    this.lights = new Lights(scene);
    this.world = new World(scene, launchPositions);
    this.effects = new Effects(this.pool, this.sound, this.lights);
    this.scheduler = new Scheduler();

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
    });

    this.positions = new Float32Array(PARTICLE_CAPACITY * 3);
    this.colors = new Float32Array(PARTICLE_CAPACITY * 3);
    this.sizes = new Float32Array(PARTICLE_CAPACITY);

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.sizeAttribute = new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
    this.geometry.setAttribute('size', this.sizeAttribute);
    this.geometry.setDrawRange(0, 0);

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  attachListenerToCamera(camera: THREE.Camera): void {
    if (this.camera === camera) return;
    this.camera?.remove(this.sound.listener);
    this.camera = camera;
    camera.add(this.sound.listener);
  }

  setLaunchPositions(positions: LaunchPosition[]): void {
    this.world.rebuild(positions);
  }

  setMuted(muted: boolean): void {
    this.sound.setMuted(muted);
  }

  setCues(cues: ReplayCue[]): void {
    this.scheduler.setCues(cues);
    this.snapshots.length = 0;
    this.nextSnapshotAt = 0;
    this.seekTo(this.elapsed);
  }

  /**
   * Drive timeline. Scrubbing or large jumps silently rebuild the particle
   * state at the target time; normal forward playback emits sound.
   */
  setElapsed(target: number): void {
    const next = Math.max(0, target);
    const delta = next - this.elapsed;
    if (delta < -0.0001 || delta > LARGE_JUMP_SECONDS) {
      this.seekTo(next);
      return;
    }
    if (delta <= 0.0001) return;
    this.advanceTo(next, true);
  }

  /** Drop all live particles & flash lights — used at end-of-show flush. */
  clear(): void {
    this.pool.reset();
    this.lights.reset();
    this.syncGeometry();
  }

  private fireCue(cue: ReplayCue, audible: boolean): void {
    const design = scaleDesignForCaliber(
      safeParseFireworkDesign(cue.firework.rawSpec),
      cue.firework.caliber,
    );
    const idx = (cue as ReplayCue & { launchPositionIndex?: number }).launchPositionIndex ?? 0;
    const pos = this.world.getLaunchPosition(idx);
    const seed = mixSeed(
      cue.seedOverride ?? undefined,
      cue.id,
      cue.firework.id,
      cue.timeSeconds,
      idx,
    );
    this.effects.fire(design, pos, {
      rng: createSeededRng(seed),
      audible,
    });
  }

  /** Seek using nearest snapshot if available, otherwise full rebuild. */
  private seekTo(target: number): void {
    const snap = this.findSnapshot(target);
    if (snap && snap.time <= target) {
      this.restoreSnapshot(snap.state);
      this.elapsed = snap.time;
      this.time = snap.time;
      this.scheduler.resetFiredAfter(snap.time);
      this.nextSnapshotAt = snap.time + this.SNAPSHOT_INTERVAL;
      this.syncGeometry();
      if (target > snap.time) this.advanceTo(target, false);
      return;
    }
    this.pool.reset();
    this.lights.reset();
    this.scheduler.resetAll();
    this.elapsed = 0;
    this.time = 0;
    this.snapshots.length = 0;
    this.nextSnapshotAt = 0;
    this.syncGeometry();
    if (target > 0) this.advanceTo(target, false);
  }

  private advanceTo(target: number, audible: boolean): void {
    const dt = audible ? FIXED_DT : SCRUB_DT;
    let cursor = this.elapsed;
    while (cursor + 0.0001 < target) {
      const next = Math.min(target, cursor + dt);
      const due = this.scheduler.pop(cursor, next);
      for (const cue of due) {
        this.fireCue(cue, audible);
      }
      this.tickPhysics(next - cursor);
      cursor = next;
      // Skip frames with mid-flight shells: their detonation callbacks
      // would be lost on restore and leave dangling ascending particles.
      if (cursor >= this.nextSnapshotAt && !this.poolHasMidFlightShells()) {
        this.snapshots.push({ time: cursor, state: this.captureSnapshot() });
        if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift();
        this.nextSnapshotAt = cursor + this.SNAPSHOT_INTERVAL;
      }
    }
    this.elapsed = target;
    this.syncGeometry();
  }

  private tickPhysics(dt: number): void {
    this.time += dt;
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const count = this.pool.aliveCount;
    for (let slot = 0; slot < count; slot++) {
      const p = ps[live[slot]];
      if (p.alive) p.update(dt, this.time);
    }
    this.pool.compactAliveMax();
    this.lights.update();
  }

  private syncGeometry(): void {
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const positions = this.positions;
    const colors = this.colors;
    const sizes = this.sizes;
    const count = this.pool.aliveCount;
    let drawCount = 0;
    for (let slot = 0; slot < count; slot++) {
      const p = ps[live[slot]];
      if (!p.alive) continue;
      const pi = drawCount * 3;
      positions[pi] = p.x;
      positions[pi + 1] = p.y;
      positions[pi + 2] = p.z;
      const isStar = p.mass <= 0.0015;
      // Subtle shimmer — enough to read as "alive" without strobing. Higher
      // amplitudes and faster frequencies caused per-particle flicker that
      // looked like noise rather than burning chemistry.
      const twinkle = isStar ? 0.9 + 0.1 * Math.sin(p.life * 4 + p.i * 0.5) : 1;
      sizes[drawCount] = renderParticleSize(p);
      const alpha = renderParticleAlpha(p) * twinkle;
      // Heat gradient: fresh stars (lifeRatio > 0.7) lean toward white-hot,
      // then settle into their pure burst colour as they cool — matches the
      // way burning magnesium chemistry actually looks.
      const lifeRatio = clamp(p.life / Math.max(p.maxLife, p.life, 0.001), 0, 1);
      const heat = isStar ? Math.max(0, lifeRatio - 0.7) : 0;
      const cool = 1 - heat;
      const heatAdd = heat * alpha * BRIGHTNESS_BOOST;
      colors[pi] = Math.min(1, p.color.r * alpha * BRIGHTNESS_BOOST * cool + heatAdd);
      colors[pi + 1] = Math.min(1, p.color.g * alpha * BRIGHTNESS_BOOST * cool + heatAdd);
      colors[pi + 2] = Math.min(1, p.color.b * alpha * BRIGHTNESS_BOOST * cool + heatAdd);
      drawCount++;
    }
    this.geometry.setDrawRange(0, drawCount);
    if (drawCount > 0) {
      const positionCount = drawCount * 3;
      this.positionAttribute.clearUpdateRanges();
      this.positionAttribute.addUpdateRange(0, positionCount);
      this.positionAttribute.needsUpdate = true;

      this.colorAttribute.clearUpdateRanges();
      this.colorAttribute.addUpdateRange(0, positionCount);
      this.colorAttribute.needsUpdate = true;

      this.sizeAttribute.clearUpdateRanges();
      this.sizeAttribute.addUpdateRange(0, drawCount);
      this.sizeAttribute.needsUpdate = true;
    }
  }

  private captureSnapshot(): PoolSnapshot {
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const liveCount = this.pool.aliveCount;
    let count = 0;
    for (let slot = 0; slot < liveCount; slot++) {
      if (ps[live[slot]].alive) count++;
    }
    const state: PoolSnapshot = {
      indices: new Uint32Array(count),
      data: new Float32Array(count * SNAPSHOT_STRIDE),
      current: this.pool.current,
      aliveMax: this.pool.aliveMax,
    };
    let w = 0;
    for (let slot = 0; slot < liveCount; slot++) {
      const i = live[slot];
      const p = ps[i];
      if (!p.alive) continue;
      state.indices[w] = i;
      const o = w * SNAPSHOT_STRIDE;
      state.data[o] = p.x;
      state.data[o + 1] = p.y;
      state.data[o + 2] = p.z;
      state.data[o + 3] = p.vx;
      state.data[o + 4] = p.vy;
      state.data[o + 5] = p.vz;
      state.data[o + 6] = p.life;
      state.data[o + 7] = p.size;
      state.data[o + 8] = p.color.r;
      state.data[o + 9] = p.color.g;
      state.data[o + 10] = p.color.b;
      state.data[o + 11] = p.mass;
      state.data[o + 12] = p.decay;
      state.data[o + 13] = p.gravity;
      state.data[o + 14] = p.drag;
      state.data[o + 15] = p.maxLife;
      w++;
    }
    return state;
  }

  private restoreSnapshot(state: PoolSnapshot): void {
    // Wipe live state cheaply via reset, then write back snapshot slots.
    this.pool.reset();
    this.lights.reset();
    const ps = this.pool.particles;
    for (let w = 0; w < state.indices.length; w++) {
      const i = state.indices[w];
      const p = ps[i];
      const o = w * SNAPSHOT_STRIDE;
      p.x = state.data[o];
      p.y = state.data[o + 1];
      p.z = state.data[o + 2];
      p.vx = state.data[o + 3];
      p.vy = state.data[o + 4];
      p.vz = state.data[o + 5];
      p.life = state.data[o + 6];
      p.size = state.data[o + 7];
      p.color.setRGB(state.data[o + 8], state.data[o + 9], state.data[o + 10]);
      p.mass = state.data[o + 11];
      p.decay = state.data[o + 12];
      p.gravity = state.data[o + 13];
      p.drag = state.data[o + 14];
      p.maxLife = state.data[o + 15] || p.life;
      // Behaviour callbacks are lost on snapshot restore; remaining motion
      // keeps the captured physics until life expires. Acceptable for scrubbing.
      this.pool.restore(i, p);
    }
    this.pool.current = state.current;
    this.pool.aliveMax = state.aliveMax;
  }

  /** Shells use mass=0.5 (vs 0.001-0.02 for flair/smoke); detect by mass. */
  private poolHasMidFlightShells(): boolean {
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const count = this.pool.aliveCount;
    for (let slot = 0; slot < count; slot++) {
      const p = ps[live[slot]];
      if (p.alive && p.mass >= 0.1) return true;
    }
    return false;
  }

  private findSnapshot(target: number): { time: number; state: PoolSnapshot } | null {
    let best: { time: number; state: PoolSnapshot } | null = null;
    for (const s of this.snapshots) {
      if (s.time <= target && (!best || s.time > best.time)) best = s;
    }
    return best;
  }

  getStats(): FireworksEngineStats {
    return {
      cues: this.scheduler.size(),
      particles: this.pool.aliveCount,
      scheduledEvents: this.scheduler.size(),
    };
  }

  /** Test/manual trigger from a specific design + launch index. */
  fireDesign(design: FireworkDesign, launchIndex = 0): void {
    const pos = this.world.getLaunchPosition(launchIndex);
    this.effects.fire(design, pos, {
      rng: createSeededRng(mixSeed('manual', this.elapsed, launchIndex)),
      audible: true,
    });
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.lights.dispose();
    this.world.dispose();
    if (this.camera) this.camera.remove(this.sound.listener);
  }
}

function renderParticleSize(p: Particle): number {
  const base = Math.sqrt(Math.max(0, p.size));
  const isFlash = p.mass >= 0.1 && p.maxLife < 0.7;
  if (isFlash) return clamp(base * 1.0, 0.8, 13);
  if (p.mass >= 0.1) return clamp(base * 1.4, 1.2, 24);
  if (p.mass <= 0.0015) return clamp(base * 1.5, 1.0, 32);
  if (p.mass <= 0.003) return clamp(base * 1.05, 0.8, 14);
  return clamp(base * 1.15, 0.9, 17);
}

function renderParticleAlpha(p: Particle): number {
  const maxLife = Math.max(p.maxLife, p.life, 0.001);
  const lifeRatio = clamp(p.life / maxLife, 0, 1);
  const ageRatio = 1 - lifeRatio;
  const fadeIn = p.mass <= 0.003 ? clamp(ageRatio * 18, 0, 1) : 1;
  const isFlash = p.mass >= 0.1 && p.maxLife < 0.7;
  let peak = 0.24;
  if (isFlash) peak = 0.075;
  else if (p.mass >= 0.1) peak = 0.2;
  else if (p.mass <= 0.0015) peak = 0.7;
  else if (p.mass <= 0.003) peak = 0.14;

  const fade = Math.pow(lifeRatio, isFlash ? 2.2 : 1.25);
  return clamp(peak * fadeIn * fade, 0, 0.72);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
