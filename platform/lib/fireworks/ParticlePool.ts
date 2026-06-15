/**
 * Object-pool of {@link Particle}s shared by all firework effects.
 *
 * Allocating thousands of particles per burst at 60fps would crush the GC,
 * so we pre-allocate a fixed-size pool and reuse slots. `acquire()` finds
 * the next free particle; particles that go out of life return to the pool
 * automatically on update.
 */
import { Particle } from '@/lib/fireworks/Particle';

export type ParticleProps = {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  size?: number;
  shape?: number;
  rotation?: number;
  spin?: number;
  life?: number;
  mass?: number;
  decay?: number;
  gravity?: number;
  drag?: number;
  h?: number;
  s?: number;
  l?: number;
  r?: number;
  g?: number;
  b?: number;
  condition?: (p: Particle, dt: number, t: number) => boolean | void;
  action?: (p: Particle, dt: number, t: number) => void;
  effect?: (p: Particle, dt: number, t: number) => void;
};

const NEVER: NonNullable<ParticleProps['condition']> = () => false;
const NOOP: NonNullable<ParticleProps['effect']> = () => {};

export class ParticlePool {
  particles: Particle[] = [];
  current = -1;
  /** Highest live pool index, kept for snapshots and cheap diagnostics. */
  aliveMax = -1;
  /** Compact list of particles that are live or awaiting compaction. */
  aliveIndices: Uint32Array;
  private activeSlots: Int32Array;
  private activeCount = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.aliveIndices = new Uint32Array(capacity);
    this.activeSlots = new Int32Array(capacity);
    this.activeSlots.fill(-1);
    for (let i = 0; i < capacity; i++) {
      this.particles.push(new Particle(i));
    }
  }

  reset(): void {
    for (let slot = 0; slot < this.activeCount; slot++) {
      const i = this.aliveIndices[slot];
      this.particles[i].reset();
      this.activeSlots[i] = -1;
    }
    this.current = -1;
    this.aliveMax = -1;
    this.activeCount = 0;
  }

  get aliveCount(): number {
    return this.activeCount;
  }

  /** Drop particles that reset themselves during update and keep live indices compact. */
  compactAliveMax(): void {
    let max = -1;
    let write = 0;
    for (let read = 0; read < this.activeCount; read++) {
      const i = this.aliveIndices[read];
      if (!this.particles[i].alive) {
        this.activeSlots[i] = -1;
        continue;
      }
      this.aliveIndices[write] = i;
      this.activeSlots[i] = write;
      write++;
      if (i > max) max = i;
    }
    this.activeCount = write;
    this.aliveMax = max;
  }

  new(prop: ParticleProps): Particle {
    this.current++;
    if (this.current >= this.particles.length) this.current = 0;
    const p = this.particles[this.current];

    const life = prop.life ?? 1;
    if (!Number.isFinite(life) || life <= 0) {
      // Refuse to spawn dead particles; otherwise a reused slot can linger.
      p.reset();
      return p;
    }

    p.alive = true;
    p.x = prop.x;
    p.y = prop.y;
    p.z = prop.z;
    p.vx = prop.vx ?? 0;
    p.vy = prop.vy ?? 0;
    p.vz = prop.vz ?? 0;
    p.size = prop.size ?? 1;
    p.shape = prop.shape ?? 0;
    p.rotation = prop.rotation ?? 0;
    p.spin = prop.spin ?? 0;
    p.life = life;
    p.maxLife = life;
    p.mass = prop.mass && prop.mass > 0 ? prop.mass : 1;
    p.decay = prop.decay ?? 10;
    p.gravity = prop.gravity ?? -9.82;
    p.drag = prop.drag ?? 0;
    p.color.setRGB(1, 1, 1);
    if (prop.h !== undefined && prop.s !== undefined && prop.l !== undefined) {
      p.color.setHSL(prop.h, prop.s, prop.l);
    }
    if (prop.r !== undefined) p.color.r = prop.r;
    if (prop.g !== undefined) p.color.g = prop.g;
    if (prop.b !== undefined) p.color.b = prop.b;
    p.condition = (prop.condition ?? NEVER) as Particle['condition'];
    p.action = prop.action ?? NOOP;
    p.effect = prop.effect ?? NOOP;

    this.activate(this.current);
    return p;
  }

  restore(index: number, particle: Particle): void {
    particle.alive = true;
    this.activate(index);
  }

  private activate(index: number): void {
    if (this.activeSlots[index] === -1) {
      this.activeSlots[index] = this.activeCount;
      this.aliveIndices[this.activeCount] = index;
      this.activeCount++;
    }
    if (index > this.aliveMax) this.aliveMax = index;
  }
}
