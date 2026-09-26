/**
 * Pooled point lights that flash with each shell burst.
 *
 * A small ring of lights is recycled — when a burst fires we grab an idle
 * light, position it at the burst, and fade it out over ~0.5s. Cheap enough
 * to keep on every cue without GPU thrash.
 */
import * as THREE from 'three';

const BASE_HEMISPHERE_INTENSITY = 0.5;
const HEMISPHERE_FADE_PER_SECOND = 6;
const POINT_FADE_PER_SECOND = 60;

class FlashLight {
  light: THREE.PointLight;
  alive = false;

  constructor(scene: THREE.Scene) {
    this.light = new THREE.PointLight(0x332200, 0, 100);
    scene.add(this.light);
  }

  set(
    pos: THREE.Vector3 | { x: number; y: number; z: number },
    color: THREE.Color,
    intensity: number,
  ): void {
    this.light.position.set(pos.x, pos.y, pos.z);
    this.light.intensity = intensity;
    this.light.color.copy(color);
    this.alive = true;
  }

  update(dt: number): void {
    this.light.intensity = Math.max(0, this.light.intensity - POINT_FADE_PER_SECOND * dt);
    this.alive = this.light.intensity > 0;
  }
}

export class Lights {
  ambient: THREE.AmbientLight;
  hemi: THREE.HemisphereLight;
  private pool: FlashLight[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, poolSize = 10) {
    this.scene = scene;
    this.ambient = new THREE.AmbientLight(0x202530, 0.6);
    scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xaa6677, 0xaacc22, BASE_HEMISPHERE_INTENSITY);
    scene.add(this.hemi);
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(new FlashLight(scene));
    }
  }

  setHemi(intensity: number, r: number, g: number, b: number): void {
    if (intensity <= 0) return;
    this.hemi.intensity = BASE_HEMISPHERE_INTENSITY + intensity;
    this.hemi.color.setRGB(r, g, b);
  }

  newLight(pos: { x: number; y: number; z: number }, color: THREE.Color, intensity: number): void {
    const slot = this.pool.find((l) => !l.alive) ?? this.pool[0];
    slot.set(pos, color, intensity);
  }

  update(dt: number): void {
    for (const l of this.pool) {
      if (l.alive) l.update(dt);
    }
    this.hemi.intensity = Math.max(
      BASE_HEMISPHERE_INTENSITY,
      this.hemi.intensity - HEMISPHERE_FADE_PER_SECOND * dt,
    );
    if (this.hemi.intensity === BASE_HEMISPHERE_INTENSITY) {
      this.hemi.color.setRGB(0.66666, 0.4, 0.46666);
    }
  }

  reset(): void {
    this.hemi.intensity = BASE_HEMISPHERE_INTENSITY;
    this.hemi.color.setRGB(0.66666, 0.4, 0.46666);
    for (const l of this.pool) {
      l.light.intensity = 0;
      l.alive = false;
    }
  }

  dispose(): void {
    this.scene.remove(this.ambient);
    this.scene.remove(this.hemi);
    for (const l of this.pool) this.scene.remove(l.light);
    this.pool.length = 0;
  }
}
