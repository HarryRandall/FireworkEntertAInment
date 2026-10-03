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
// Prototype smoke buffer budget, in puffs, retained to bound each frame.
const MAX_SMOKE_PUFFS = 6000;
// Prototype smoke visibility threshold, in normalised opacity.
const SMOKE_ALPHA_CUTOFF = 0.003;
/** Additive particle discriminators shared with the consuming view. */
export const ParticleKind = { Spark: 0, Head: 1, Halo: 2, Flash: 3 } as const;
/** One additive particle discriminator. */
export type ParticleKind = (typeof ParticleKind)[keyof typeof ParticleKind];
/** Tightly sized additive attributes plus a separate smoke frame. */
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
  /** Separate normal-blended smoke attributes, ordered by puff. */
  smoke: SmokeParticles;
}
/** Normal-blended puff attributes independent of the additive particle list. */
export interface SmokeParticles {
  /** Interleaved [x, y, z] puff centres in metres, with ground clearance. */
  positions: Float32Array;
  /** Interleaved linear RGB components, ordered by puff. */
  colours: Float32Array;
  /** Puff billboard sizes in world metres, ordered by puff. */
  sizes: Float32Array;
  /** Normalised puff opacity, ordered by puff. */
  alphas: Float32Array;
  /** Dimensionless deterministic noise seed for each puff. */
  seeds: Float32Array;
  /** Seconds since emission, ordered by puff. */
  ages: Float32Array;
}
interface Puff {
  position: Vec3;
  colour: Vec3;
  size: number;
  alpha: number;
  seed: number;
  age: number;
}
type Particle = { position: Vec3; colour: Vec3; size: number; alpha: number; kind: ParticleKind };
/** Collects one frame with prototype particle budgets and head-to-quad expansion. */
export class ParticleWriter {
  /** Enables source sprays, smoke and launch embellishments independently. */
  constructor(
    /** Whether spray callers append their reference spark points. */
    readonly sprays = true,
    /** Whether normal-blended smoke puffs are collected. */
    readonly smokeEnabled = true,
    /** Whether flame, blossoms and climb crackle are collected. */
    readonly launchEffects = true,
  ) {}
  private puffs: Puff[] = [];
  /** Appends a puff at a centre in metres, with linear RGB, size in metres and age in seconds. */
  smoke(
    x: number,
    y: number,
    z: number,
    colour: Vec3,
    size: number,
    alpha: number,
    seed: number,
    age: number,
  ): void {
    if (this.smokeEnabled && this.puffs.length < MAX_SMOKE_PUFFS && alpha > SMOKE_ALPHA_CUTOFF)
      this.puffs.push({
        position: [x, Math.max(y, size * 0.5), z],
        colour,
        size,
        alpha,
        seed,
        age,
      });
  }
  private points: Particle[] = [];
  private quads: Particle[] = [];
  /** Appends a point at a position in metres with linear RGB, renderer size and opacity. */
  spark(position: Vec3, colour: Vec3, size: number, alpha: number): void {
    if (this.points.length < MAX_POINT_PARTICLES && alpha > ALPHA_CUTOFF)
      this.points.push({ position, colour, size, alpha, kind: ParticleKind.Spark });
  }
  /** Appends an additive quad at a position in metres with renderer size and opacity. */
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
  /** Expands a head into a quad and optional halo from metre position and renderer size. */
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
  /** Returns fresh, tightly sized attribute arrays for the collected frame. */
  finish(): Particles {
    const all = [...this.points, ...this.quads];
    const result: Particles = {
      positions: new Float32Array(all.length * 3),
      colours: new Float32Array(all.length * 3),
      sizes: new Float32Array(all.length),
      alphas: new Float32Array(all.length),
      kinds: new Uint8Array(all.length),
      smoke: {
        positions: new Float32Array(this.puffs.length * 3),
        colours: new Float32Array(this.puffs.length * 3),
        sizes: new Float32Array(this.puffs.length),
        alphas: new Float32Array(this.puffs.length),
        seeds: new Float32Array(this.puffs.length),
        ages: new Float32Array(this.puffs.length),
      },
    };
    all.forEach((p, i) => {
      result.positions.set(p.position, i * 3);
      result.colours.set(p.colour, i * 3);
      result.sizes[i] = p.size;
      result.alphas[i] = p.alpha;
      result.kinds[i] = p.kind;
    });
    this.puffs.forEach((p, i) => {
      result.smoke.positions.set(p.position, i * 3);
      result.smoke.colours.set(p.colour, i * 3);
      result.smoke.sizes[i] = p.size;
      result.smoke.alphas[i] = p.alpha;
      result.smoke.seeds[i] = p.seed;
      result.smoke.ages[i] = p.age;
    });
    return result;
  }
}
