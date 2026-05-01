import * as THREE from "three";
import { ParticlePool, type ParticleWrite } from "@/lib/fireworks/ParticlePool";
import {
  fireworkParticleFragmentShader,
  fireworkParticleVertexShader,
} from "@/lib/fireworks/shaders";

export type GpuParticleSystemOptions = {
  capacity: number;
  blending: THREE.Blending;
  depthWrite: boolean;
  renderOrder: number;
  pointScale?: number;
  exposure?: number;
  softness?: number;
};

export class GpuParticleSystem {
  readonly pool: ParticlePool;
  readonly material: THREE.ShaderMaterial;
  readonly points: THREE.Points;

  constructor(options: GpuParticleSystemOptions) {
    this.pool = new ParticlePool(options.capacity);
    this.material = new THREE.ShaderMaterial({
      vertexShader: fireworkParticleVertexShader,
      fragmentShader: fireworkParticleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uPointScale: { value: options.pointScale ?? 1 },
        uExposure: { value: options.exposure ?? 1 },
        uSoftness: { value: options.softness ?? 0.5 },
        uWind: { value: new THREE.Vector3(0.02, 0, 0) },
      },
      transparent: true,
      depthWrite: options.depthWrite,
      depthTest: true,
      blending: options.blending,
    });
    this.points = new THREE.Points(this.pool.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = options.renderOrder;
  }

  clear(): void {
    this.pool.clear();
  }

  write(particle: ParticleWrite): void {
    this.pool.write(particle);
  }

  commit(): void {
    this.pool.commit();
  }

  setTime(elapsed: number): void {
    this.material.uniforms.uTime.value = elapsed;
  }

  setPixelRatio(pixelRatio: number): void {
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  setWind(wind: THREE.Vector3): void {
    this.material.uniforms.uWind.value.copy(wind);
  }

  dispose(): void {
    this.pool.dispose();
    this.material.dispose();
  }
}
