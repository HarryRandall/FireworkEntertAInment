import * as THREE from "three";

type Callback = (p: Particle, dt: number, time: number) => void;

const NOOP: Callback = () => {};

export class Particle {
  i = 0;
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  mass = 0;
  alive = false;
  size = 0;
  color = new THREE.Color();
  decay = 0;
  life = 0;
  gravity = -9.82;

  condition: Callback = NOOP;
  action: Callback = NOOP;
  effect: Callback = NOOP;

  constructor(i: number) {
    this.i = i;
  }

  update(dt: number, time: number): void {
    this.life -= dt;
    this.size -= dt * this.decay;

    const Cd = 0.47;
    const rho = 1.22;
    const A = Math.PI / 10000;
    let Fx = (-0.5 * Cd * A * rho * this.vx * this.vx * this.vx) / Math.abs(this.vx);
    let Fy = (-0.5 * Cd * A * rho * this.vy * this.vy * this.vy) / Math.abs(this.vy);
    let Fz = (-0.5 * Cd * A * rho * this.vz * this.vz * this.vz) / Math.abs(this.vz);
    if (Number.isNaN(Fx)) Fx = 0;
    if (Number.isNaN(Fy)) Fy = 0;
    if (Number.isNaN(Fz)) Fz = 0;

    const ax = Fx / this.mass;
    const ay = this.gravity + Fy / this.mass;
    const az = Fz / this.mass;

    this.vx += ax * dt;
    this.vy += ay * dt;
    this.vz += az * dt;

    this.x += this.vx * dt * 100;
    this.y += this.vy * dt * 100;
    this.z += this.vz * dt * 100;

    // Note: condition runs first; if true the particle resets and we skip effect.
    let conditionMet = false;
    try {
      conditionMet = !!(this.condition as unknown as (p: Particle, dt: number, t: number) => unknown)(this, dt, time);
    } catch {
      conditionMet = false;
    }
    if (conditionMet) {
      this.action(this, dt, time);
      this.reset();
      return;
    }

    this.effect(this, dt, time);

    if (this.life <= 0 || this.size <= 0) {
      this.reset();
    }
  }

  reset(): void {
    this.alive = false;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.mass = 0;
    this.size = 0;
    this.decay = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.life = 0;
    this.condition = NOOP;
    this.action = NOOP;
    this.effect = NOOP;
  }
}
