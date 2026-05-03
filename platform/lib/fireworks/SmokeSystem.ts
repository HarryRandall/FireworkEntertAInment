import * as THREE from "three";
import { GpuParticleSystem } from "@/lib/fireworks/GpuParticleSystem";
import type { ParticleWrite } from "@/lib/fireworks/ParticlePool";

export class SmokeSystem {
  readonly particles: GpuParticleSystem;
  readonly object: THREE.Object3D;

  constructor(capacity: number) {
    this.particles = new GpuParticleSystem({
      capacity,
      blending: THREE.NormalBlending,
      depthWrite: false,
      renderOrder: 8,
      pointScale: 2.1,
      exposure: 0.5,
      softness: 0.28,
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
