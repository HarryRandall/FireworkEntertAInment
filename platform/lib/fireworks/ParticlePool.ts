import { Particle } from "@/lib/fireworks/Particle";

export type ParticleProps = {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  size?: number;
  life?: number;
  mass?: number;
  decay?: number;
  gravity?: number;
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

export class ParticlePool {
  particles: Particle[] = [];
  current = 0;
  /** Highest index ever used since last reset; allows tight iteration. */
  aliveMax = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    for (let i = 0; i < capacity; i++) {
      this.particles.push(new Particle(i));
    }
  }

  reset(): void {
    const upTo = Math.min(this.aliveMax + 1, this.particles.length);
    for (let i = 0; i < upTo; i++) this.particles[i].reset();
    this.current = 0;
    this.aliveMax = 0;
  }

  get aliveCount(): number {
    let n = 0;
    const cap = this.aliveMax + 1;
    for (let i = 0; i < cap; i++) if (this.particles[i].alive) n++;
    return n;
  }

  /** Recompute aliveMax after a tick — call once per frame in engine. */
  compactAliveMax(): void {
    let max = 0;
    const cap = this.aliveMax + 1;
    for (let i = 0; i < cap; i++) if (this.particles[i].alive) max = i;
    this.aliveMax = max;
  }

  new(prop: ParticleProps): Particle {
    this.current++;
    if (this.current >= this.particles.length) this.current = 0;
    const p = this.particles[this.current];

    const life = prop.life ?? 1;
    if (!Number.isFinite(life) || life <= 0) {
      // Refuse to spawn dead particles — would otherwise persist.
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
    p.life = life;
    p.mass = prop.mass && prop.mass > 0 ? prop.mass : 1;
    p.decay = prop.decay ?? 10;
    p.gravity = prop.gravity ?? -9.82;
    if (prop.h !== undefined && prop.s !== undefined && prop.l !== undefined) {
      p.color.setHSL(prop.h, prop.s, prop.l);
    }
    if (prop.r !== undefined) p.color.r = prop.r;
    if (prop.g !== undefined) p.color.g = prop.g;
    if (prop.b !== undefined) p.color.b = prop.b;
    p.condition = (prop.condition ?? (() => false)) as Particle["condition"];
    p.action = prop.action ?? (() => {});
    p.effect = prop.effect ?? (() => {});

    if (this.current > this.aliveMax) this.aliveMax = this.current;
    return p;
  }
}
