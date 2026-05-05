import * as THREE from "three";
import type { ReplayCue } from "@/lib/shows";
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

export type FireworksEngineStats = {
  cues: number;
  particles: number;
  scheduledEvents: number;
};

const PARTICLE_CAPACITY = 100_000;
const SPARK_TEXTURE_URL = "/textures/spark1.png";
const FIXED_DT = 1 / 60;
const LARGE_JUMP_SECONDS = 0.35;

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
    this.geometry.setDrawRange(0, PARTICLE_CAPACITY);

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
    this.rebuildAt(this.elapsed);
  }

  /**
   * Drive timeline. Scrubbing or large jumps silently rebuild the particle
   * state at the target time; normal forward playback emits sound.
   */
  setElapsed(target: number): void {
    const next = Math.max(0, target);
    const delta = next - this.elapsed;
    if (delta < -0.0001 || delta > LARGE_JUMP_SECONDS) {
      this.rebuildAt(next);
      return;
    }
    if (delta <= 0.0001) return;
    this.advanceTo(next, true);
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

  private rebuildAt(target: number): void {
    this.pool.reset();
    this.lights.reset();
    this.scheduler.resetAll();
    this.elapsed = 0;
    this.time = 0;
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
    }
    this.elapsed = target;
  }

  private tick(dt: number): void {
    this.time += dt;
    const ps = this.pool.particles;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.alive) p.update(dt, this.time);
    }
    this.syncGeometry();
    this.lights.update();
  }

  private syncGeometry(): void {
    const ps = this.pool.particles;
    const positions = this.positions;
    const colors = this.colors;
    const sizes = this.sizes;
    for (let i = 0; i < ps.length; i++) {
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
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
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
