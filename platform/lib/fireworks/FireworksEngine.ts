import * as THREE from "three";
import type { ReplayCue } from "@/lib/show-domain";
import {
  DEFAULT_LAUNCH_POSITIONS,
  type FireworkDesign,
  type LaunchPosition,
  safeParseFireworkDesign,
} from "@/lib/fireworks/design";
import { ParticlePool } from "@/lib/fireworks/ParticlePool";
import { SoundHandler } from "@/lib/fireworks/SoundHandler";
import { Lights } from "@/lib/fireworks/Lights";
import { World } from "@/lib/fireworks/World";
import { Effects } from "@/lib/fireworks/Effects";
import { Scheduler } from "@/lib/fireworks/Scheduler";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "@/lib/fireworks/shaders";
import { createSeededRng, mixSeed } from "@/lib/fireworks/random";

type PoolSnapshot = {
  indices: Uint32Array;
  /** packed [x,y,z,vx,vy,vz,life,size,r,g,b,mass,decay,gravity,drag] per particle */
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
const SPARK_TEXTURE_URL = "/textures/spark1.png";
const FIXED_DT = 1 / 60;
const LARGE_JUMP_SECONDS = 0.35;
const SNAPSHOT_STRIDE = 15;

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
  private texture: THREE.Texture;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

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

    this.texture = new THREE.TextureLoader().load(SPARK_TEXTURE_URL);
    this.material = new THREE.ShaderMaterial({
      uniforms: { pointTexture: { value: this.texture } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
      vertexColors: true,
    });

    this.positions = new Float32Array(PARTICLE_CAPACITY * 3);
    this.colors = new Float32Array(PARTICLE_CAPACITY * 3);
    this.sizes = new Float32Array(PARTICLE_CAPACITY);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      "size",
      new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage),
    );
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
    const design = safeParseFireworkDesign(cue.firework.rawSpec);
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
    let cursor = this.elapsed;
    while (cursor + 0.0001 < target) {
      const next = Math.min(target, cursor + FIXED_DT);
      const due = this.scheduler.pop(cursor, next);
      for (const cue of due) {
        this.fireCue(cue, audible);
      }
      this.tick(next - cursor);
      cursor = next;
      // Snapshot at coarse intervals while not in real-time playback.
      // Skip frames with mid-flight shells: their detonation callbacks
      // would be lost on restore and leave dangling ascending particles.
      if (
        !audible &&
        cursor >= this.nextSnapshotAt &&
        !this.poolHasMidFlightShells()
      ) {
        this.snapshots.push({ time: cursor, state: this.captureSnapshot() });
        this.nextSnapshotAt = cursor + this.SNAPSHOT_INTERVAL;
      }
    }
    this.elapsed = target;
  }

  private tick(dt: number): void {
    this.time += dt;
    const ps = this.pool.particles;
    const cap = this.pool.aliveMax + 1;
    for (let i = 0; i < cap; i++) {
      const p = ps[i];
      if (p.alive) p.update(dt, this.time);
    }
    this.pool.compactAliveMax();
    this.syncGeometry();
    this.lights.update();
  }

  private syncGeometry(): void {
    const ps = this.pool.particles;
    const positions = this.positions;
    const colors = this.colors;
    const sizes = this.sizes;
    const cap = this.pool.aliveMax + 1;
    for (let i = 0; i < cap; i++) {
      const p = ps[i];
      const pi = i * 3;
      if (p.alive) {
        positions[pi] = p.x;
        positions[pi + 1] = p.y;
        positions[pi + 2] = p.z;
        sizes[i] = p.size;
        colors[pi] = p.color.r;
        colors[pi + 1] = p.color.g;
        colors[pi + 2] = p.color.b;
      } else {
        sizes[i] = 0;
      }
    }
    this.geometry.setDrawRange(0, cap);
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  private captureSnapshot(): PoolSnapshot {
    const ps = this.pool.particles;
    const cap = this.pool.aliveMax + 1;
    let count = 0;
    for (let i = 0; i < cap; i++) if (ps[i].alive) count++;
    const state: PoolSnapshot = {
      indices: new Uint32Array(count),
      data: new Float32Array(count * SNAPSHOT_STRIDE),
      current: this.pool.current,
      aliveMax: this.pool.aliveMax,
    };
    let w = 0;
    for (let i = 0; i < cap; i++) {
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
      p.alive = true;
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
      // Behaviour callbacks are lost on snapshot restore; remaining motion
      // keeps the captured physics until life expires. Acceptable for scrubbing.
    }
    this.pool.current = state.current;
    this.pool.aliveMax = state.aliveMax;
  }

  /** Shells use mass=0.5 (vs 0.001-0.02 for flair/smoke); detect by mass. */
  private poolHasMidFlightShells(): boolean {
    const ps = this.pool.particles;
    const cap = this.pool.aliveMax + 1;
    for (let i = 0; i < cap; i++) {
      const p = ps[i];
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
      rng: createSeededRng(mixSeed("manual", this.elapsed, launchIndex)),
      audible: true,
    });
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.lights.dispose();
    this.world.dispose();
    if (this.camera) this.camera.remove(this.sound.listener);
  }
}
