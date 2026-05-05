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

export type FireworksEngineStats = {
  cues: number;
  particles: number;
  scheduledEvents: number;
};

const PARTICLE_CAPACITY = 100_000;
const SPARK_TEXTURE_URL = "/textures/spark1.png";
const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;

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
  private accumulator = 0;
  private lastSetElapsed = 0;
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
    this.scheduler.resetFiredAfter(this.elapsed);
  }

  /**
   * Drive timeline. On a backwards seek (target < lastSetElapsed) we clear the
   * pool and rewind so cues prior to the new target play again.
   */
  setElapsed(target: number): void {
    if (target < this.lastSetElapsed) {
      this.pool.reset();
      this.scheduler.resetAll();
      this.elapsed = 0;
      this.accumulator = 0;
    }
    const prevElapsed = this.elapsed;
    const due = this.scheduler.pop(prevElapsed, target);
    for (const cue of due) {
      this.fireCue(cue);
    }
    const dt = Math.max(0, target - this.elapsed);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.tick(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.accumulator = 0;
    this.elapsed = target;
    this.lastSetElapsed = target;
  }

  private fireCue(cue: ReplayCue): void {
    const design = safeParseFireworkDesign(cue.firework.spec as unknown);
    const idx = (cue as ReplayCue & { launchPositionIndex?: number }).launchPositionIndex ?? 0;
    const pos = this.world.getLaunchPosition(idx);
    this.effects.fire(design, pos);
  }

  private tick(dt: number): void {
    this.time += dt;
    const ps = this.pool.particles;
    const positions = this.positions;
    const colors = this.colors;
    const sizes = this.sizes;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.alive) p.update(dt, this.time);
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
    this.lights.update();
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
    this.effects.fire(design, pos);
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
