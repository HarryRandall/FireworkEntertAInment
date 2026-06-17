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

/**
 * Shape sentinel for particles that should simulate (fly, run their effect
 * callbacks) but never be drawn, e.g. hidden brocade heads that still emit
 * their trail squares.
 */
export const HIDDEN_PARTICLE_SHAPE = -1;
export const TRAIL_SHAPE_CIRCLE = 0;
export const TRAIL_SHAPE_SQUARE = 1;
export const TRAIL_SHAPE_TRIANGLE = 1.25;
export const HEAD_STYLE_STRIDE = 1;

export function headShapeValue(glowStrength: number, styleIndex: number): number {
  return 2 + Math.max(0, styleIndex) * HEAD_STYLE_STRIDE + glowStrength * 0.25;
}

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
  alpha = 1;
  shape = 0;
  rotation = 0;
  spin = 0;
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

    this.rotation += this.spin * dt;

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
    // Brocade heads carry a higher shape value and need to keep their full
    // burst vector, otherwise large crowns flatten instead of scaling as a
    // sphere. Hidden heads (negative sentinel shape) are still heads.
    const isBrocadeHead = this.shape > 1.5 || this.shape <= HIDDEN_PARTICLE_SHAPE;
    const lateralLimit = isBrocadeHead ? 18 : VMAX_LATERAL;
    const downwardLimit = isBrocadeHead ? 18 : VMAX_DOWN;
    if (this.vy < -downwardLimit) this.vy = -downwardLimit;
    if (this.vx > lateralLimit) this.vx = lateralLimit;
    else if (this.vx < -lateralLimit) this.vx = -lateralLimit;
    if (this.vz > lateralLimit) this.vz = lateralLimit;
    else if (this.vz < -lateralLimit) this.vz = -lateralLimit;

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
    this.alpha = 1;
    this.shape = 0;
    this.rotation = 0;
    this.spin = 0;
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
