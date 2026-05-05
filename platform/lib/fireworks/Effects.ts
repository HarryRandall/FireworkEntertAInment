import * as THREE from "three";
import type { Particle } from "@/lib/fireworks/Particle";
import type { ParticlePool } from "@/lib/fireworks/ParticlePool";
import type { SoundHandler } from "@/lib/fireworks/SoundHandler";
import type { Lights } from "@/lib/fireworks/Lights";
import type { FireworkDesign } from "@/lib/fireworks/design";

type Pos = { x: number; y: number; z: number };

const PATTERN_SEED: Record<FireworkDesign["pattern"], 1 | 2 | 3> = {
  fibonacci: 1,
  wave: 2,
  strobe: 3,
};

function rangeRand(range: [number, number]): number {
  const [a, b] = range;
  return a + Math.random() * (b - a);
}

function resolveColor(
  color: FireworkDesign["color"],
): { r: number; g: number; b: number } {
  if (color === "random") {
    return {
      r: 0.3 + Math.random() * 0.7,
      g: 0.3 + Math.random() * 0.7,
      b: 0.3 + Math.random() * 0.7,
    };
  }
  return color;
}

export class Effects {
  constructor(
    private pp: ParticlePool,
    private sh: SoundHandler,
    private lights: Lights,
  ) {}

  fire(design: FireworkDesign, position: Pos): void {
    const seed = PATTERN_SEED[design.pattern];
    const color = new THREE.Color(0, 0, 0);
    const rgb = resolveColor(design.color);
    color.setRGB(rgb.r, rgb.g, rgb.b);

    const size = design.size;
    if (design.mortar.sound) this.sh.playRandomMortar(1.0);
    this.lights.newLight(
      { x: position.x, y: 30, z: position.z },
      new THREE.Color(0.7, 0.3, 0),
      10,
    );
    this.spawnMortarSmoke(position, design.mortar.smokeParticles);

    this.pp.new({
      x: position.x,
      y: position.y,
      z: position.z,
      size,
      mass: 0.5,
      vy: design.liftVelocity ?? 10 + Math.min(size / 30, 7),
      vx: 0,
      vz: 0,
      h: 0.9,
      s: 0.5,
      l: 0.5,
      r: color.r,
      g: color.g,
      b: color.b,
      life: design.shellLife,
      decay: 10 + Math.random() * 20,
      effect: (p, dt, t) => this.shellEffect(p, dt, t, seed),
      condition: (p) => p.vy <= -Math.random() * 20,
      action: (p, dt, t) => this.detonate(p, dt, t, design, color, seed),
    });
  }

  private spawnMortarSmoke(pos: Pos, count: number): void {
    for (let i = 0; i < count; i++) {
      this.pp.new({
        x: pos.x + 10 - Math.random() * 20,
        y: pos.y + 30 + Math.random() * 5,
        z: pos.z + 10 - Math.random() * 20,
        mass: 0.002,
        gravity: Math.random(),
        size: 20 + Math.random() * 100,
        h: 0.5,
        s: 0.5,
        l: 0.5,
        r: 0.2,
        g: 0.2,
        b: 0.2,
        life: Math.random() * 5,
        decay: 20 + Math.random() * 20,
        effect: (p, _dt, time) => {
          p.vz += Math.sin(time * Math.random()) / 50;
          p.vx += Math.sin(time * Math.random()) / 50;
        },
      });
    }
  }

  private shellEffect(
    particle: Particle,
    _dt: number,
    time: number,
    seed: 1 | 2 | 3,
  ): void {
    let max = 1;
    let vx = 0;
    let vz = 0;
    switch (seed) {
      case 1:
        max = Math.random() * 30;
        break;
      case 2:
        particle.x += Math.cos(Math.PI * 2 * time) * Math.random() * 3;
        particle.z += Math.sin(Math.PI * 2 * time) * Math.random() * 3;
        break;
      case 3:
        particle.size = Math.random() > 0.5 ? 150 : 10;
        max = Math.random() * 10;
        vx = 2 - Math.random() * 4;
        vz = 2 - Math.random() * 4;
        break;
    }
    for (let i = 0; i < max; i++) {
      this.pp.new({
        x: particle.x,
        y: particle.y,
        z: particle.z,
        mass: 0.002,
        gravity: -0.2,
        size: 20 + Math.random() * 40,
        vx,
        vz,
        r: 1.0,
        g: 0,
        b: 0,
        h: 1.0,
        s: 0.5,
        l: 0.0,
        life: Math.random() * 3,
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
  ): void {
    // Sound
    const boom = design.sound.boom;
    if (boom === "heavy" || (boom === "auto" && design.size > 200)) {
      this.sh.playRandomHeavyBoom(1.0);
    } else {
      this.sh.playRandomLightBoom(1.0);
    }

    // Hemisphere flash tinted by burst color.
    this.lights.setHemi(design.size / 100, color.r, color.g, color.b);

    this.explodeBurst(particle);

    const grav = rangeRand(design.burst.gravity);
    const speedRange = design.burst.speed;
    const lifeRange = design.burst.life;
    const speed = rangeRand(speedRange);
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
          vy = 1 + Math.random() * 2;
          vx = Math.sin(i * Math.PI * 2 * speed) * (2 - Math.random() * 4);
          vz = Math.sin(i * Math.PI * 2 * speed) * (2 - Math.random() * 4);
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
        vx,
        vy,
        vz,
        r: color.r,
        g: color.g,
        b: color.b,
        h: Math.random(),
        s: Math.random(),
        l: Math.random(),
        life: 0.5 + Math.random() * (lifeRange[1] - lifeRange[0] + lifeRange[0]),
        decay: Math.random() * 100,
        effect: (p, dt, t) => this.flairEffect(p, dt, t, seed, color, design),
      });
    }
  }

  private explodeBurst(particle: Particle): void {
    const count = 100 + Math.floor(Math.random() * 200);
    for (let i = 0; i < count; i++) {
      this.pp.new({
        x: particle.x,
        y: particle.y,
        z: particle.z,
        size: Math.random() * 80,
        mass: 0.5,
        gravity: -0.5,
        vy: 1 - Math.random() * 2,
        vx: 1 - Math.random() * 2,
        vz: 1 - Math.random() * 2,
        life: 0.1 + Math.random(),
        decay: Math.random() * 50,
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
  ): void {
    let r = 1.0;
    let g = 0;
    let b = 0;
    const strobe = design.burst.flairSizeStrobe;
    switch (seed) {
      case 1:
        if (strobe) {
          particle.size = Math.random() > 0.5 ? strobe[1] : strobe[0];
        } else {
          particle.size = Math.random() > 0.5 ? 250 : 10;
        }
        break;
      case 2:
        if (particle.vy < 0) {
          particle.x += Math.cos(Math.PI * 2 * time) * Math.random() * 3;
          particle.z += Math.sin(Math.PI * 2 * time) * Math.random() * 3;
        }
        break;
      case 3:
        particle.size = Math.random() > 0.5 ? 150 : 10;
        if (design.burst.flairColorMode !== "random" && Math.random() > 0.5) {
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
      Math.random() < design.crackle.probability
    ) {
      this.crackleEffect(particle, dt, time, design, color);
      particle.reset();
      return;
    }

    if (!design.flair.enabled) return;

    this.pp.new({
      x: particle.x,
      y: particle.y,
      z: particle.z,
      mass: 0.002,
      gravity: -0.2,
      size: 20 + Math.random() * 40,
      r,
      g,
      b,
      h: 1.0,
      s: 0.5,
      l: 0.0,
      life: Math.random() * 3,
      decay: 50,
    });
  }

  private crackleEffect(
    particle: Particle,
    _dt: number,
    _time: number,
    design: FireworkDesign,
    color: THREE.Color,
  ): void {
    if (Math.random() < 0.2) {
      switch (design.crackle.sound) {
        case "lightBoom":
          this.sh.playRandomLightBoom(0.1);
          break;
        case "heavyBoom":
          this.sh.playRandomHeavyBoom(0.1);
          break;
        default:
          this.sh.playRandomCrackle(0.1);
      }
    }
    const colored = design.crackle.sound === "heavyBoom";
    const r = colored ? color.r * 2 : 0;
    const g = colored ? color.g * 2 : 0;
    const b = colored ? color.b : 0;
    const count = 10 + Math.floor(Math.random() * 150);
    for (let i = 0; i < count; i++) {
      this.pp.new({
        x: particle.x,
        y: particle.y,
        z: particle.z,
        size: Math.random() * 80,
        mass: 0.02,
        gravity: -0.2,
        r,
        g,
        b,
        h: Math.random(),
        s: Math.random(),
        l: Math.random(),
        vy: 1 - Math.random() * 2,
        vx: 1 - Math.random() * 2,
        vz: 1 - Math.random() * 2,
        life: 0.1 + Math.random() * 2,
        decay: Math.random() * 50,
      });
    }
  }
}
