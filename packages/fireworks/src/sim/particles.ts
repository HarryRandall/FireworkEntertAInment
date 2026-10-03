/** Compact, deterministic particle-frame writer shared by every simulation path. */
import type { Vec3 } from './colour';

// Prototype rendering budgets and alpha cut-off; sizes are renderer-space pixels.
const MAX_POINT_PARTICLES = 140000;
const MAX_QUAD_PARTICLES = 24000;
const ALPHA_CUTOFF = 0.004;
const HALO_SIZE_MULTIPLIER = 2.4;
const HALO_SIZE_MAX_PX = 4.2;
const HALO_ALPHA_MULTIPLIER = 0.12;
const HEAD_SIZE_MULTIPLIER = 1.1;
export const ParticleKind = { Spark: 0, Head: 1, Halo: 2, Flash: 3 } as const;
export type ParticleKind = (typeof ParticleKind)[keyof typeof ParticleKind];
export interface Particles {
  /** Interleaved [x, y, z] world positions in metres, ordered by particle. */
  positions: Float32Array;
  /** Interleaved linear-RGB components in [0, 1], ordered by particle. */
  colours: Float32Array;
  /** Renderer-space point or quad size in pixels, ordered by particle. */
  sizes: Float32Array;
  /** Normalised opacity in [0, 1], ordered by particle. */
  alphas: Float32Array;
  /** `ParticleKind` discriminator ordered with the parallel attribute arrays. */
  kinds: Uint8Array;
}
type Particle = { position: Vec3; colour: Vec3; size: number; alpha: number; kind: ParticleKind };
// Retain the prototype's separate point/quad budgets and head-to-quad expansion.
export class ParticleWriter {
  private points: Particle[] = [];
  private quads: Particle[] = [];
  spark(position: Vec3, colour: Vec3, size: number, alpha: number): void {
    if (this.points.length < MAX_POINT_PARTICLES && alpha > ALPHA_CUTOFF)
      this.points.push({ position, colour, size, alpha, kind: ParticleKind.Spark });
  }
  glow(
    position: Vec3,
    colour: Vec3,
    size: number,
    alpha: number,
    kind: ParticleKind = ParticleKind.Flash,
  ): void {
    if (this.quads.length < MAX_QUAD_PARTICLES && alpha > ALPHA_CUTOFF)
      this.quads.push({ position, colour, size, alpha, kind });
  }
  head(position: Vec3, colour: Vec3, size: number, alpha: number, halo = 1): void {
    if (halo > 0)
      this.glow(
        position,
        colour,
        Math.min(size * HALO_SIZE_MULTIPLIER, HALO_SIZE_MAX_PX),
        alpha * HALO_ALPHA_MULTIPLIER * halo,
        ParticleKind.Halo,
      );
    this.glow(position, colour, size * HEAD_SIZE_MULTIPLIER, alpha, ParticleKind.Head);
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
