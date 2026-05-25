/**
 * Single particle used by the fireworks renderer.
 *
 * Particles are plain mutable structs — the {@link ParticlePool} owns
 * allocation and recycling, while {@link Effects} applies the per-frame
 * `update` callback. Keeping the struct small (no per-particle Three.js
 * objects) is what lets us push thousands of particles per shell.
 */
import * as THREE from 'three';

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
  maxLife = 0;
  gravity = -9.82;
  drag = 0;

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
    const ay = (-k * this.vy * Math.abs(this.vy)) / this.mass;
    const az = (-k * this.vz * Math.abs(this.vz)) / this.mass;

    this.vx = applyDragStep(this.vx, ax * dt);
    this.vy = applyDragStep(this.vy, ay * dt) + this.gravity * dt;
    this.vz = applyDragStep(this.vz, az * dt);

    if (this.drag > 0) {
      const damping = Math.exp(-this.drag * dt);
      this.vx *= damping;
      this.vy *= damping;
      this.vz *= damping;
    }

    // Terminal-velocity clamp. Without this, sparks free-fall through
    // the entire scene because gravity*dt accumulates over multi-second
    // lifetimes. Asymmetric so rising shells aren't capped as hard.
    const VMAX_DOWN = 4;
    const VMAX_LATERAL = 6;
    if (this.vy < -VMAX_DOWN) this.vy = -VMAX_DOWN;
    if (this.vx > VMAX_LATERAL) this.vx = VMAX_LATERAL;
    else if (this.vx < -VMAX_LATERAL) this.vx = -VMAX_LATERAL;
    if (this.vz > VMAX_LATERAL) this.vz = VMAX_LATERAL;
    else if (this.vz < -VMAX_LATERAL) this.vz = -VMAX_LATERAL;

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
    this.gravity = -9.82;
    this.drag = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.life = 0;
    this.maxLife = 0;
    this.condition = NOOP;
    this.action = NOOP;
    this.effect = NOOP;
  }
}

function applyDragStep(velocity: number, delta: number): number {
  const next = velocity + delta;
  if (velocity !== 0 && Math.sign(next) !== Math.sign(velocity)) return 0;
  return next;
}
