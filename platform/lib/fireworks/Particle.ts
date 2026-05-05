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
  mass = 1;
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

    // Quadratic drag, sign-preserving. Avoids NaN from 0/|0|.
    const k = 0.5 * 0.47 * 1.22 * (Math.PI / 10000);
    const ax = (-k * this.vx * Math.abs(this.vx)) / this.mass;
    const ay = this.gravity + (-k * this.vy * Math.abs(this.vy)) / this.mass;
    const az = (-k * this.vz * Math.abs(this.vz)) / this.mass;

    this.vx += ax * dt;
    this.vy += ay * dt;
    this.vz += az * dt;

    this.x += this.vx * dt * 100;
    this.y += this.vy * dt * 100;
    this.z += this.vz * dt * 100;

    const cond = (this.condition as (p: Particle, dt: number, t: number) => unknown)(
      this,
      dt,
      time,
    );
    if (cond) {
      this.action(this, dt, time);
      this.reset();
      return;
    }

    this.effect(this, dt, time);

    if (
      this.life <= 0 ||
      this.size <= 0 ||
      (this.vy < 0 && this.y <= 0) ||
      !Number.isFinite(this.x) ||
      !Number.isFinite(this.y) ||
      !Number.isFinite(this.z)
    ) {
      this.reset();
    }
  }

  reset(): void {
    this.alive = false;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.mass = 1;
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
