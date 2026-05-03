import * as THREE from "three";
import type { ReplayCue } from "@/lib/shows";
import { GpuParticleSystem } from "@/lib/fireworks/GpuParticleSystem";
import { FireworkScheduler } from "@/lib/fireworks/FireworkScheduler";
import { emitCompiledEvent } from "@/lib/fireworks/EffectCompiler";
import { TrailSystem } from "@/lib/fireworks/TrailSystem";
import { SmokeSystem } from "@/lib/fireworks/SmokeSystem";

export type FireworksEngineOptions = {
  maxParticles?: number;
  maxTrailParticles?: number;
  maxSmokeParticles?: number;
  pixelRatio?: number;
  debug?: boolean;
};

export type FireworksEngineStats = {
  cues: number;
  scheduledEvents: number;
  particles: number;
  trailParticles: number;
  smokeParticles: number;
};

export class FireworksEngine {
  readonly group = new THREE.Group();
  readonly particles: GpuParticleSystem;
  readonly trails: TrailSystem;
  readonly smoke: SmokeSystem;

  private readonly scheduler = new FireworkScheduler();
  private elapsed = 0;
  private initialized = false;
  private readonly wind = new THREE.Vector3(0.018, 0, -0.004);

  constructor(private readonly scene: THREE.Scene, options: FireworksEngineOptions = {}) {
    this.particles = new GpuParticleSystem({
      capacity: options.maxParticles ?? 120_000,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      renderOrder: 20,
      pointScale: 1.8,
      exposure: 1.4,
      softness: 0.55,
    });
    this.trails = new TrailSystem(options.maxTrailParticles ?? 180_000);
    this.smoke = new SmokeSystem(options.maxSmokeParticles ?? 18_000);
    this.group.name = "FireworksEngineV2";
    this.group.add(this.smoke.object, this.trails.object, this.particles.points);
    this.scene.add(this.group);
    this.setPixelRatio(options.pixelRatio ?? 1);
  }

  setCues(cues: ReplayCue[]): void {
    this.scheduler.setCues(cues);
    this.rebuildAt(this.elapsed);
  }

  setElapsed(elapsed: number): void {
    const nextElapsed = Math.max(0, elapsed);
    const scrubbedBack = nextElapsed + 0.0001 < this.elapsed;
    const largeJump = nextElapsed - this.elapsed > 1.25;

    if (!this.initialized || scrubbedBack || largeJump) {
      this.rebuildAt(nextElapsed);
    } else {
      const events = this.scheduler.getEventsBetween(this.elapsed, nextElapsed);
      for (const event of events) {
        emitCompiledEvent(event, this.emitTargets);
      }
      if (events.length > 0) this.commit();
    }

    this.elapsed = nextElapsed;
    this.initialized = true;
    this.updateUniforms(nextElapsed);
  }

  setPixelRatio(pixelRatio: number): void {
    const clamped = Math.max(1, Math.min(2.5, pixelRatio));
    this.particles.setPixelRatio(clamped);
    this.trails.setPixelRatio(clamped);
    this.smoke.setPixelRatio(clamped);
  }

  getStats(): FireworksEngineStats {
    return {
      cues: this.scheduler.getCueCount(),
      scheduledEvents: this.scheduler.getEventCount(),
      particles: this.particles.pool.count,
      trailParticles: this.trails.particles.pool.count,
      smokeParticles: this.smoke.particles.pool.count,
    };
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.particles.dispose();
    this.trails.dispose();
    this.smoke.dispose();
  }

  private get emitTargets() {
    return {
      particles: this.particles,
      trails: this.trails,
      smoke: this.smoke,
    };
  }

  private rebuildAt(elapsed: number): void {
    this.clear();
    const activeEvents = this.scheduler.getActiveEventsAt(elapsed);
    for (const event of activeEvents) {
      emitCompiledEvent(event, this.emitTargets);
    }
    this.commit();
  }

  private clear(): void {
    this.particles.clear();
    this.trails.clear();
    this.smoke.clear();
  }

  private commit(): void {
    this.particles.commit();
    this.trails.commit();
    this.smoke.commit();
  }

  private updateUniforms(elapsed: number): void {
    this.particles.setTime(elapsed);
    this.trails.setTime(elapsed);
    this.smoke.setTime(elapsed);
    this.particles.setWind(this.wind);
    this.trails.setWind(this.wind);
    this.smoke.setWind(this.wind.clone().multiplyScalar(1.8));
  }
}
