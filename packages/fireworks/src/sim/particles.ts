import type { Vec3 } from './colour';
export const ParticleKind = { Spark: 0, Head: 1, Halo: 2, Flash: 3 } as const;
export type ParticleKind = (typeof ParticleKind)[keyof typeof ParticleKind];
export interface Particles {
  positions: Float32Array;
  colours: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
  kinds: Uint8Array;
}
type Particle = { position: Vec3; colour: Vec3; size: number; alpha: number; kind: ParticleKind };
// Retain the prototype's separate point/quad budgets and head-to-quad expansion.
export class ParticleWriter {
  private points: Particle[] = [];
  private quads: Particle[] = [];
  spark(position: Vec3, colour: Vec3, size: number, alpha: number): void {
    if (this.points.length < 140000 && alpha > 0.004)
      this.points.push({ position, colour, size, alpha, kind: ParticleKind.Spark });
  }
  glow(
    position: Vec3,
    colour: Vec3,
    size: number,
    alpha: number,
    kind: ParticleKind = ParticleKind.Flash,
  ): void {
    if (this.quads.length < 24000 && alpha > 0.004)
      this.quads.push({ position, colour, size, alpha, kind });
  }
  head(position: Vec3, colour: Vec3, size: number, alpha: number, halo = 1): void {
    if (halo > 0)
      this.glow(
        position,
        colour,
        Math.min(size * 2.4, 4.2),
        alpha * 0.12 * halo,
        ParticleKind.Halo,
      );
    this.glow(position, colour, size * 1.1, alpha, ParticleKind.Head);
  }
  finish(): Particles {
    const all = [...this.points, ...this.quads];
    const result: Particles = {
      positions: new Float32Array(all.length * 3),
      colours: new Float32Array(all.length * 3),
      sizes: new Float32Array(all.length),
      alphas: new Float32Array(all.length),
      kinds: new Uint8Array(all.length),
    };
    all.forEach((p, i) => {
      result.positions.set(p.position, i * 3);
      result.colours.set(p.colour, i * 3);
      result.sizes[i] = p.size;
      result.alphas[i] = p.alpha;
      result.kinds[i] = p.kind;
    });
    return result;
  }
}
