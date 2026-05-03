import * as THREE from "three";
import { GpuParticleSystem } from "@/lib/fireworks/GpuParticleSystem";
import type { ParticleWrite } from "@/lib/fireworks/ParticlePool";

export class TrailSystem {
  readonly particles: GpuParticleSystem;
  readonly object: THREE.Object3D;

  constructor(capacity: number) {
    this.particles = new GpuParticleSystem({
      capacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      renderOrder: 18,
      pointScale: 1.75,
      exposure: 1.85,
      softness: 0.78,
    });
    this.object = this.particles.points;
  }

  clear(): void {
    this.particles.clear();
  }

  write(particle: ParticleWrite): void {
    this.particles.write(particle);
  }

  commit(): void {
    this.particles.commit();
  }

  setTime(elapsed: number): void {
    this.particles.setTime(elapsed);
  }

  setPixelRatio(pixelRatio: number): void {
    this.particles.setPixelRatio(pixelRatio);
  }

  setWind(wind: THREE.Vector3): void {
    this.particles.setWind(wind);
  }

  dispose(): void {
    this.particles.dispose();
  }
}
