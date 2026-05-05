import * as THREE from "three";

class FlashLight {
  light: THREE.PointLight;
  alive = false;

  constructor(scene: THREE.Scene) {
    this.light = new THREE.PointLight(0x332200, 0, 100);
    scene.add(this.light);
  }

  set(pos: THREE.Vector3 | { x: number; y: number; z: number }, color: THREE.Color, intensity: number): void {
    this.light.position.set(pos.x, pos.y, pos.z);
    this.light.intensity = intensity;
    this.light.color.copy(color);
    this.alive = true;
  }

  update(): void {
    if (this.light.intensity > 0) {
      this.light.intensity -= 1;
    } else {
      this.alive = false;
    }
  }
}

export class Lights {
  ambient: THREE.AmbientLight;
  hemi: THREE.HemisphereLight;
  private pool: FlashLight[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, poolSize = 10) {
    this.scene = scene;
    this.ambient = new THREE.AmbientLight(0x404040);
    scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xaa6677, 0xaacc22, 0.5);
    scene.add(this.hemi);
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(new FlashLight(scene));
    }
  }

  setHemi(intensity: number, r: number, g: number, b: number): void {
    this.hemi.intensity = intensity;
    this.hemi.color.setRGB(r, g, b);
  }

  newLight(
    pos: { x: number; y: number; z: number },
    color: THREE.Color,
    intensity: number,
  ): void {
    const slot = this.pool.find((l) => !l.alive) ?? this.pool[0];
    slot.set(pos, color, intensity);
  }

  update(): void {
    for (const l of this.pool) {
      if (l.alive) l.update();
    }
    if (this.hemi.intensity > 0.5) {
      this.hemi.intensity -= 0.1;
    } else {
      this.hemi.color.setRGB(0.66666, 0.4, 0.46666);
    }
  }

  reset(): void {
    this.hemi.intensity = 0.5;
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
