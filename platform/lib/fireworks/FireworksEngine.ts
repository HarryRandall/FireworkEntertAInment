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

export type FireworksSkyLight = {
  color: THREE.Color;
  intensity: number;
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
      pointScale: 2.35,
      exposure: 2.05,
      softness: 0.46,
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

  getSkyLight(): FireworksSkyLight {
    const events = this.scheduler.getActiveEventsAt(this.elapsed);
    const color = new THREE.Color(0x050712);
    const mixed = new THREE.Color(0x000000);
    let weight = 0;
    let flashWeight = 0;

    for (const event of events) {
      const age = Math.max(0, this.elapsed - event.time);
      const duration = Math.max(0.001, event.expiresAt - event.time);
      const life = Math.max(0, 1 - age / duration);
      const eventWeight = event.kind === "flash" ? life * 8 : Math.pow(life, 0.65);
      if (event.kind === "flash") flashWeight += eventWeight;
      mixed.add(new THREE.Color(event.color).multiplyScalar(eventWeight));
      weight += eventWeight;
    }

    if (weight > 0) {
      mixed.multiplyScalar(1 / weight);
      color.lerp(mixed, 0.12);
    }

    return {
      color,
      intensity: Math.min(0.28, Math.pow(weight / 650, 0.68) * 0.24 + flashWeight * 0.004),
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
