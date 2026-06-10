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
  compileFireworkDesign,
  scaleDesignForCaliber,
} from '@/lib/fireworks/design';
import { ParticlePool } from '@/lib/fireworks/ParticlePool';
import { SoundHandler } from '@/lib/fireworks/SoundHandler';
import { Lights } from '@/lib/fireworks/Lights';
import { World } from '@/lib/fireworks/World';
import { Effects } from '@/lib/fireworks/Effects';
import { Scheduler } from '@/lib/fireworks/Scheduler';
import {
  FRAGMENT_SHADER,
  SMOKE_FRAGMENT_SHADER,
  SMOKE_VERTEX_SHADER,
  VERTEX_SHADER,
} from '@/lib/fireworks/shaders';
import { createSeededRng, mixSeed } from '@/lib/fireworks/random';
import type { Particle } from '@/lib/fireworks/Particle';

type PoolSnapshot = {
  indices: Uint32Array;
  /** packed [x,y,z,vx,vy,vz,life,size,r,g,b,mass,decay,gravity,drag,maxLife,shape] per particle */
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
// Scrub rebuilds can be coarser than playback; procedural emitters compensate
// by ageing particles across each rebuilt segment.
const SCRUB_DT = 1 / 24;
const LARGE_JUMP_SECONDS = 0.35;
const SNAPSHOT_STRIDE = 17;
const MAX_SNAPSHOTS = 120;
const BRIGHTNESS_BOOST = 1.55;
const MAX_COLOR_INTENSITY = 1.75;
const SMOKE_BRIGHTNESS_BOOST = 1.8;

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
  private smokeGeometry: THREE.BufferGeometry;
  private smokeMaterial: THREE.ShaderMaterial;
  private smokePoints: THREE.Points;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private shapes: Float32Array;
  private smokePositions: Float32Array;
  private smokeColors: Float32Array;
  private smokeSizes: Float32Array;
  private positionAttribute: THREE.BufferAttribute;
  private colorAttribute: THREE.BufferAttribute;
  private sizeAttribute: THREE.BufferAttribute;
  private shapeAttribute: THREE.BufferAttribute;
  private smokePositionAttribute: THREE.BufferAttribute;
  private smokeColorAttribute: THREE.BufferAttribute;
  private smokeSizeAttribute: THREE.BufferAttribute;

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
    this.smokeMaterial = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERTEX_SHADER,
      fragmentShader: SMOKE_FRAGMENT_SHADER,
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
    });

    this.positions = new Float32Array(PARTICLE_CAPACITY * 3);
    this.colors = new Float32Array(PARTICLE_CAPACITY * 3);
    this.sizes = new Float32Array(PARTICLE_CAPACITY);
    this.shapes = new Float32Array(PARTICLE_CAPACITY);
    this.smokePositions = new Float32Array(PARTICLE_CAPACITY * 3);
    this.smokeColors = new Float32Array(PARTICLE_CAPACITY * 3);
    this.smokeSizes = new Float32Array(PARTICLE_CAPACITY);

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.sizeAttribute = new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage);
    this.shapeAttribute = new THREE.BufferAttribute(this.shapes, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
    this.geometry.setAttribute('size', this.sizeAttribute);
    this.geometry.setAttribute('shape', this.shapeAttribute);
    this.geometry.setDrawRange(0, 0);

    this.smokeGeometry = new THREE.BufferGeometry();
    this.smokePositionAttribute = new THREE.BufferAttribute(this.smokePositions, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.smokeColorAttribute = new THREE.BufferAttribute(this.smokeColors, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.smokeSizeAttribute = new THREE.BufferAttribute(this.smokeSizes, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.smokeGeometry.setAttribute('position', this.smokePositionAttribute);
    this.smokeGeometry.setAttribute('color', this.smokeColorAttribute);
    this.smokeGeometry.setAttribute('size', this.smokeSizeAttribute);
    this.smokeGeometry.setDrawRange(0, 0);

    this.smokePoints = new THREE.Points(this.smokeGeometry, this.smokeMaterial);
    this.smokePoints.frustumCulled = false;
    this.smokePoints.renderOrder = 1;
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.smokePoints);
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
      cue.firework.renderDesign ?? compileFireworkDesign({ legacySpec: cue.firework.rawSpec }),
      cue.firework.caliber,
    );
    const idx = (cue as ReplayCue & { launchPositionIndex?: number }).launchPositionIndex ?? 0;
    const basePos = this.world.getLaunchPosition(idx);
    const override = cue.shotPositionOverride;
    const pos = override
      ? {
          x: basePos.x + override.x,
          y: basePos.y + override.y,
          z: basePos.z + override.z,
        }
      : basePos;
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
      panDegrees: cue.shotPanDegrees ?? 0,
      tiltDegrees: cue.shotTiltDegrees ?? 0,
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
      // Skip frames with live callback-driven particles: those callbacks are
      // intentionally not serialised, so restoring them would change effects.
      if (cursor >= this.nextSnapshotAt && !this.poolHasLiveCallbackParticles()) {
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
    const shapes = this.shapes;
    const smokePositions = this.smokePositions;
    const smokeColors = this.smokeColors;
    const smokeSizes = this.smokeSizes;
    const count = this.pool.aliveCount;
    let drawCount = 0;
    let smokeDrawCount = 0;
    for (let slot = 0; slot < count; slot++) {
      const p = ps[live[slot]];
      if (!p.alive) continue;
      const isStar = p.mass <= 0.0015;
      const isSmoke = p.mass >= 0.004 && p.mass < 0.01;
      // Subtle shimmer — enough to read as "alive" without strobing. Higher
      // amplitudes and faster frequencies caused per-particle flicker that
      // looked like noise rather than burning chemistry.
      const twinkle = isStar ? 0.9 + 0.1 * Math.sin(p.life * 4 + p.i * 0.5) : 1;
      const alpha = renderParticleAlpha(p) * twinkle;
      if (isSmoke) {
        const si = smokeDrawCount * 3;
        const smokeTone = alpha * SMOKE_BRIGHTNESS_BOOST;
        smokePositions[si] = p.x;
        smokePositions[si + 1] = p.y;
        smokePositions[si + 2] = p.z;
        smokeSizes[smokeDrawCount] = renderParticleSize(p);
        smokeColors[si] = clamp((p.color.r + 0.13) * smokeTone, 0, 0.52);
        smokeColors[si + 1] = clamp((p.color.g + 0.14) * smokeTone, 0, 0.54);
        smokeColors[si + 2] = clamp((p.color.b + 0.16) * smokeTone, 0, 0.58);
        smokeDrawCount++;
        continue;
      }
      const pi = drawCount * 3;
      positions[pi] = p.x;
      positions[pi + 1] = p.y;
      positions[pi + 2] = p.z;
      sizes[drawCount] = renderParticleSize(p);
      shapes[drawCount] = p.shape;
      // Heat gradient: fresh stars (lifeRatio > 0.7) lean toward white-hot,
      // then settle into their pure burst colour as they cool — matches the
      // way burning magnesium chemistry actually looks.
      const lifeRatio = clamp(p.life / Math.max(p.maxLife, p.life, 0.001), 0, 1);
      // Brocade head orbs (shape 2) keep their pure green/red; white-hot
      // tinting made them blend into the burst centre.
      const heat = isStar && p.shape < 1.5 ? Math.max(0, lifeRatio - 0.72) * 0.8 : 0;
      const cool = 1 - heat;
      const heatAdd = heat * alpha * BRIGHTNESS_BOOST;
      colors[pi] = Math.min(
        MAX_COLOR_INTENSITY,
        p.color.r * alpha * BRIGHTNESS_BOOST * cool + heatAdd,
      );
      colors[pi + 1] = Math.min(
        MAX_COLOR_INTENSITY,
        p.color.g * alpha * BRIGHTNESS_BOOST * cool + heatAdd,
      );
      colors[pi + 2] = Math.min(
        MAX_COLOR_INTENSITY,
        p.color.b * alpha * BRIGHTNESS_BOOST * cool + heatAdd * 0.78,
      );
      drawCount++;
    }
    this.geometry.setDrawRange(0, drawCount);
    this.smokeGeometry.setDrawRange(0, smokeDrawCount);
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

      this.shapeAttribute.clearUpdateRanges();
      this.shapeAttribute.addUpdateRange(0, drawCount);
      this.shapeAttribute.needsUpdate = true;
    }
    if (smokeDrawCount > 0) {
      const smokePositionCount = smokeDrawCount * 3;
      this.smokePositionAttribute.clearUpdateRanges();
      this.smokePositionAttribute.addUpdateRange(0, smokePositionCount);
      this.smokePositionAttribute.needsUpdate = true;

      this.smokeColorAttribute.clearUpdateRanges();
      this.smokeColorAttribute.addUpdateRange(0, smokePositionCount);
      this.smokeColorAttribute.needsUpdate = true;

      this.smokeSizeAttribute.clearUpdateRanges();
      this.smokeSizeAttribute.addUpdateRange(0, smokeDrawCount);
      this.smokeSizeAttribute.needsUpdate = true;
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
      state.data[o + 16] = p.shape;
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
      p.shape = state.data[o + 16] || 0;
      // Behaviour callbacks are lost on snapshot restore; remaining motion
      // keeps the captured physics until life expires. Acceptable for scrubbing.
      this.pool.restore(i, p);
    }
    this.pool.current = state.current;
    this.pool.aliveMax = state.aliveMax;
  }

  /** Shells and brocade heads have live callbacks that snapshots cannot serialise. */
  private poolHasLiveCallbackParticles(): boolean {
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const count = this.pool.aliveCount;
    for (let slot = 0; slot < count; slot++) {
      const p = ps[live[slot]];
      if (!p.alive) continue;
      if (p.mass >= 0.1 || p.shape > 1.5) return true;
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
    this.scene.remove(this.smokePoints);
    this.scene.remove(this.points);
    this.smokeGeometry.dispose();
    this.geometry.dispose();
    this.smokeMaterial.dispose();
    this.material.dispose();
    this.lights.dispose();
    this.world.dispose();
    if (this.camera) this.camera.remove(this.sound.listener);
  }
}

function renderParticleSize(p: Particle): number {
  const base = Math.sqrt(Math.max(0, p.size));
  const isFlash = p.mass >= 0.1 && p.maxLife < 0.7;
  const isSmoke = p.mass >= 0.004 && p.mass < 0.01;
  if (isSmoke) return clamp(base * 1.25, 4, 28);
  if (isFlash) return clamp(base * 1.08, 1.4, 18);
  if (p.mass >= 0.1) return clamp(base * 1.38, 1.8, 24);
  // Glowing head orbs: larger size budget, but allowed to shrink with
  // distance so zoomed-out bursts don't read as pure glow. The cap sits
  // above the shader's square clamp so heads stay dominant when zoomed in.
  if (p.mass <= 0.0006) return clamp(base * 2.4, 3, 200);
  if (p.mass <= 0.0015) return clamp(base * 1.55, 1.4, 34);
  if (p.mass <= 0.003) return clamp(base * 1.05, 1.0, 14);
  return clamp(base * 1.2, 1.1, 20);
}

function renderParticleAlpha(p: Particle): number {
  const maxLife = Math.max(p.maxLife, p.life, 0.001);
  const lifeRatio = clamp(p.life / maxLife, 0, 1);
  const ageRatio = 1 - lifeRatio;
  const fadeIn = p.mass <= 0.003 ? clamp(ageRatio * 18, 0, 1) : 1;
  const isFlash = p.mass >= 0.1 && p.maxLife < 0.7;
  const isSmoke = p.mass >= 0.004 && p.mass < 0.01;
  if (isSmoke) {
    return clamp(0.34 * Math.pow(lifeRatio, 1.18), 0, 0.36);
  }
  let peak = 0.34;
  if (isFlash) peak = 0.14;
  else if (p.mass >= 0.1) peak = 0.28;
  else if (p.shape > 1.5)
    peak = 0.66; // brocade heads: bright core + glow in one sprite
  else if (p.shape > 0.5)
    peak = 0.6; // brocade trail squares read brighter
  else if (p.mass <= 0.0006)
    peak = 0.46; // glow halos: large but soft
  else if (p.mass <= 0.0015) peak = 0.82;
  else if (p.mass <= 0.003) peak = 0.2;

  const fade = Math.pow(lifeRatio, isFlash ? 1.7 : 0.96);
  return clamp(peak * fadeIn * fade, 0, 0.82);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
