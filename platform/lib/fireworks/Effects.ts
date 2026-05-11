import * as THREE from "three";
import type { Particle } from "@/lib/fireworks/Particle";
import type { ParticlePool } from "@/lib/fireworks/ParticlePool";
import type { SoundHandler } from "@/lib/fireworks/SoundHandler";
import type { Lights } from "@/lib/fireworks/Lights";
import type { FireworkDesign } from "@/lib/fireworks/design";
import type { RandomSource } from "@/lib/fireworks/random";

type Pos = { x: number; y: number; z: number };
type FireOptions = {
  rng: RandomSource;
  audible: boolean;
};

const PATTERN_SEED: Record<FireworkDesign["pattern"], 1 | 2 | 3> = {
  fibonacci: 1,
  wave: 2,
  strobe: 3,
};
const STAR_DRAG = 2.4;
const TRAIL_DRAG = 3.0;
const FLASH_DRAG = 4.0;
const MIN_STAR_GRAVITY = -0.24;
const TRAIL_GRAVITY = -0.03;

function rangeRand(range: [number, number], rng: RandomSource): number {
  const [a, b] = range;
  return a + rng.next() * (b - a);
}

function clampStarGravity(gravity: number): number {
  return Math.max(gravity, MIN_STAR_GRAVITY);
}

function randomColor(rng: RandomSource): { r: number; g: number; b: number } {
  return {
    r: 0.3 + rng.next() * 0.7,
    g: 0.3 + rng.next() * 0.7,
    b: 0.3 + rng.next() * 0.7,
  };
}

function resolveColor(
  color: FireworkDesign["color"],
  rng: RandomSource,
): { r: number; g: number; b: number } {
  return color === "random" ? randomColor(rng) : color;
}

function flairColor(
  design: FireworkDesign,
  color: THREE.Color,
  rng: RandomSource,
): { r: number; g: number; b: number } {
  if (design.burst.flairColorMode === "random") return randomColor(rng);
  if (design.burst.flairColorMode === "mixed" && rng.next() > 0.55) {
    return randomColor(rng);
  }
  return color;
}

export class Effects {
  constructor(
    private pp: ParticlePool,
    private sh: SoundHandler,
    private lights: Lights,
  ) {}

  fire(design: FireworkDesign, position: Pos, options: FireOptions): void {
    const rng = options.rng;
    const seed = PATTERN_SEED[design.pattern];
    const color = new THREE.Color(0, 0, 0);
    const rgb = resolveColor(design.color, rng);
    color.setRGB(rgb.r, rgb.g, rgb.b);

    const size = design.size;
    if (options.audible && design.mortar.sound) this.sh.playRandomMortar(1.0, rng);
    this.lights.newLight(
      { x: position.x, y: 30, z: position.z },
      new THREE.Color(0.7, 0.3, 0),
      10,
    );
    this.spawnMortarSmoke(position, design.mortar.smokeParticles, rng);

    this.pp.new({
      x: position.x,
      y: position.y,
      z: position.z,
      size,
      mass: 0.5,
      vy: design.liftVelocity ?? 11 + Math.min(size / 40, 6),
      vx: 0,
      vz: 0,
      h: 0.9,
      s: 0.5,
      l: 0.5,
      r: color.r,
      g: color.g,
      b: color.b,
      life: design.shellLife,
      decay: 10 + rng.next() * 20,
      effect: (p, dt, t) => this.shellEffect(p, dt, t, seed, color, rng),
      condition: (p) => p.vy <= 0,
      action: (p, dt, t) =>
        this.detonate(p, dt, t, design, color, seed, rng, options.audible),
    });
  }

  private spawnMortarSmoke(pos: Pos, count: number, rng: RandomSource): void {
    for (let i = 0; i < count; i++) {
      this.pp.new({
        x: pos.x + 10 - rng.next() * 20,
        y: pos.y + 30 + rng.next() * 5,
        z: pos.z + 10 - rng.next() * 20,
        mass: 0.002,
        gravity: rng.next(),
        size: 20 + rng.next() * 100,
        h: 0.5,
        s: 0.5,
        l: 0.5,
        r: 0.2,
        g: 0.2,
        b: 0.2,
        life: rng.next() * 5,
        decay: 20 + rng.next() * 20,
        effect: (p, _dt, time) => {
          p.vz += Math.sin(time * rng.next()) / 50;
          p.vx += Math.sin(time * rng.next()) / 50;
        },
      });
    }
  }

  private shellEffect(
    particle: Particle,
    _dt: number,
    time: number,
    seed: 1 | 2 | 3,
    color: THREE.Color,
    rng: RandomSource,
  ): void {
    let max = 1;
    let vx = 0;
    let vz = 0;
    switch (seed) {
      case 1:
        max = rng.next() * 30;
        break;
      case 2:
        // Tiny lateral wobble — was a strong spiral. Don't translate the
        // shell; just let the trail particles (below) inherit a small drift.
        particle.vx += (rng.next() - 0.5) * 0.05;
        particle.vz += (rng.next() - 0.5) * 0.05;
        max = rng.next() * 20;
        break;
      case 3:
        particle.size = rng.next() > 0.5 ? 150 : 10;
        max = rng.next() * 10;
        vx = 2 - rng.next() * 4;
        vz = 2 - rng.next() * 4;
        break;
    }
    for (let i = 0; i < max; i++) {
      this.pp.new({
        x: particle.x,
        y: particle.y,
        z: particle.z,
        mass: 0.002,
        gravity: -0.2,
        size: 20 + rng.next() * 40,
        vx,
        vz,
        r: color.r,
        g: color.g,
        b: color.b,
        h: 1.0,
        s: 0.5,
        l: 0.0,
        life: rng.next() * 3,
        decay: 50,
      });
    }
  }

  private detonate(
    particle: Particle,
    _dt: number,
    _time: number,
    design: FireworkDesign,
    color: THREE.Color,
    seed: 1 | 2 | 3,
    rng: RandomSource,
    audible: boolean,
  ): void {
    const boom = design.sound.boom;
    if (audible) {
      if (boom === "heavy" || (boom === "auto" && design.size > 200)) {
        this.sh.playRandomHeavyBoom(1.0, rng);
      } else {
        this.sh.playRandomLightBoom(1.0, rng);
      }
    }

    this.lights.setHemi(design.size / 100, color.r, color.g, color.b);
    this.explodeBurst(particle, rng);

    const grav = clampStarGravity(rangeRand(design.burst.gravity, rng));
    const speed = rangeRand(design.burst.speed, rng);
    const lifeRange = design.burst.life;
    const offset = 2 / design.size;
    const inc = Math.PI * (3.0 - Math.sqrt(5.0));

    for (let i = 0; i < design.size; i++) {
      let vx: number;
      let vy: number;
      let vz: number;
      switch (seed) {
        case 1: {
          vy = Math.abs(i * offset - 1 + offset / 2);
          const r = Math.sqrt(1 - vy * vy);
          const phi = ((i + 1.0) % design.size) * inc;
          vx = Math.cos(phi) * r * speed;
          vz = Math.sin(phi) * r * speed;
          vy *= speed;
          break;
        }
        case 2: {
          // Distribute over the full sphere (was upper-hemisphere only,
          // which left wave bursts looking like a dome with no bottom).
          vy = (i * offset - 1 + offset / 2) * speed;
          const r = Math.sqrt(Math.max(0, 1 - (vy / speed) * (vy / speed)));
          const phi = ((i + 1.0) % design.size) * inc;
          // Slight wave warble on top of even spread.
          const warble = 0.7 + rng.next() * 0.6;
          vx = Math.cos(phi) * r * speed * warble;
          vz = Math.sin(phi) * r * speed * warble;
          break;
        }
        default: {
          vy = i * offset - 1 + offset / 2;
          const r = Math.sqrt(1 - vy * vy);
          const phi = ((i + 1.0) % design.size) * inc;
          vx = Math.cos(phi) * r * speed;
          vz = Math.sin(phi) * r * speed;
          vy *= speed;
          break;
        }
      }

      this.pp.new({
        x: particle.x,
        y: particle.y,
        z: particle.z,
        size: design.size,
        mass: 0.001,
        gravity: grav,
        drag: STAR_DRAG,
        vx,
        vy,
        vz,
        r: color.r,
        g: color.g,
        b: color.b,
        h: rng.next(),
        s: rng.next(),
        l: rng.next(),
        life: rangeRand(lifeRange, rng),
        decay: rng.next() * 100,
        effect: (p, dt, t) =>
          this.flairEffect(p, dt, t, seed, color, design, rng, audible),
      });
    }
  }

  private explodeBurst(particle: Particle, rng: RandomSource): void {
    const count = 100 + Math.floor(rng.next() * 200);
    for (let i = 0; i < count; i++) {
      this.pp.new({
        x: particle.x,
        y: particle.y,
        z: particle.z,
        size: rng.next() * 80,
        mass: 0.5,
        gravity: TRAIL_GRAVITY,
        drag: FLASH_DRAG,
        vy: 1 - rng.next() * 2,
        vx: 1 - rng.next() * 2,
        vz: 1 - rng.next() * 2,
        life: 0.1 + rng.next(),
        decay: rng.next() * 50,
      });
    }
  }

  private flairEffect(
    particle: Particle,
    dt: number,
    time: number,
    seed: 1 | 2 | 3,
    color: THREE.Color,
    design: FireworkDesign,
    rng: RandomSource,
    audible: boolean,
  ): void {
    const trail = flairColor(design, color, rng);
    let r = trail.r;
    let g = trail.g;
    let b = trail.b;
    const strobe = design.burst.flairSizeStrobe;
    switch (seed) {
      case 1:
        if (strobe) {
          particle.size = rng.next() > 0.5 ? strobe[1] : strobe[0];
        } else {
          particle.size = rng.next() > 0.5 ? 250 : 10;
        }
        break;
      case 2:
        // Subtle drift on falling sparks only. Original implementation used
        // raw time as the angle, so a small fraction of bursts ended up
        // resonant with the per-particle phase and visibly spiralled.
        if (particle.vy < 0 && rng.next() < 0.25) {
          const phase = particle.i * 0.137;
          particle.x += Math.cos(phase + time) * 0.6;
          particle.z += Math.sin(phase + time) * 0.6;
        }
        break;
      case 3:
        particle.size = rng.next() > 0.5 ? 150 : 10;
        if (design.burst.flairColorMode !== "random" && rng.next() > 0.5) {
          r = color.r;
          g = color.g;
          b = color.b;
        }
        break;
    }

    if (
      design.crackle.enabled &&
      design.size > 250 &&
      particle.life < 1.0 &&
      rng.next() < design.crackle.probability
    ) {
      this.crackleEffect(particle, dt, time, design, color, rng, audible);
      particle.reset();
      return;
    }

    if (!design.flair.enabled) return;

    this.pp.new({
      x: particle.x,
      y: particle.y,
      z: particle.z,
      mass: 0.002,
      gravity: TRAIL_GRAVITY,
      drag: TRAIL_DRAG,
      size: 20 + rng.next() * 40,
      r,
      g,
      b,
      h: 1.0,
      s: 0.5,
      l: 0.0,
      life: rng.next() * 3,
      decay: 50,
    });
  }

  private crackleEffect(
    particle: Particle,
    _dt: number,
    _time: number,
    design: FireworkDesign,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
  ): void {
    if (audible && rng.next() < 0.2) {
      switch (design.crackle.sound) {
        case "lightBoom":
          this.sh.playRandomLightBoom(0.1, rng);
          break;
        case "heavyBoom":
          this.sh.playRandomHeavyBoom(0.1, rng);
          break;
        default:
          this.sh.playRandomCrackle(0.1, rng);
      }
    }
    const colored = design.crackle.sound === "heavyBoom";
    const r = colored ? Math.min(1, color.r * 2) : Math.max(color.r, 0.75);
    const g = colored ? Math.min(1, color.g * 2) : Math.max(color.g, 0.68);
    const b = colored ? color.b : Math.max(color.b, 0.45);
    const count = 10 + Math.floor(rng.next() * 150);
    for (let i = 0; i < count; i++) {
      this.pp.new({
        x: particle.x,
        y: particle.y,
        z: particle.z,
        size: rng.next() * 80,
        mass: 0.02,
        gravity: -0.2,
        r,
        g,
        b,
        h: rng.next(),
        s: rng.next(),
        l: rng.next(),
        vy: 1 - rng.next() * 2,
        vx: 1 - rng.next() * 2,
        vz: 1 - rng.next() * 2,
        life: 0.1 + rng.next() * 2,
        decay: rng.next() * 50,
      });
    }
  }
}
