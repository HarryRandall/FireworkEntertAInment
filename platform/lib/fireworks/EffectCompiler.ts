import * as THREE from "three";
import type { ReplayCue } from "@/lib/shows";
import type { ParticleWrite } from "@/lib/fireworks/ParticlePool";
import {
  createSeededRng,
  mixSeed,
  type SeededRng,
} from "@/lib/fireworks/random";
import {
  DEFAULT_FIREWORK_SPEC,
  FIREWORK_COLORS,
  GLITTER_PROFILES,
  hexToRgb,
  pickPrimaryColor,
  safeParseFireworkSpec,
  type FireworkColor,
  type FireworkSpec,
  type GlitterKind,
} from "@/lib/fireworks/spec";

const GROUND_Y = -1.45;
const GRAVITY = -9.8;
const STAR_DRAG = 0.92;
const SPARK_DRAG = 0.86;
const HEAVY_DRAG = 0.97;
const MAX_SPARKS_PER_STAR = 24;
const MAX_STARS_PER_BURST = 220;

export type EngineEmitTargets = {
  particles: { write: (particle: ParticleWrite) => void };
  trails: { write: (particle: ParticleWrite) => void };
  smoke: { write: (particle: ParticleWrite) => void };
};

export type CompiledStarEvent = {
  kind: "star";
  id: string;
  cueId: string;
  time: number;
  expiresAt: number;
  origin: [number, number, number];
  velocity: [number, number, number];
  acceleration: [number, number, number];
  drag: number;
  lifetime: number;
  sizeStart: number;
  sizeEnd: number;
  color: FireworkColor;
  secondColor: FireworkColor | null;
  transitionAt: number | null;
  strobeFreq: number;
  emissive: number;
  alphaCurve: number;
  seed: number;
  target: "particles" | "trails";
};

export type CompiledFlashEvent = {
  kind: "flash";
  id: string;
  cueId: string;
  time: number;
  expiresAt: number;
  origin: [number, number, number];
  color: FireworkColor;
  size: number;
  seed: number;
};

export type CompiledEffectEvent = CompiledStarEvent | CompiledFlashEvent;

const DEG2RAD = Math.PI / 180;

function rotateVec(
  v: [number, number, number],
  pan: number,
  tilt: number,
  roll: number,
): [number, number, number] {
  const cp = Math.cos(pan * DEG2RAD);
  const sp = Math.sin(pan * DEG2RAD);
  const ct = Math.cos((tilt - 90) * DEG2RAD);
  const st = Math.sin((tilt - 90) * DEG2RAD);
  const cr = Math.cos(roll * DEG2RAD);
  const sr = Math.sin(roll * DEG2RAD);
  // roll(z) → tilt(x) → pan(y)
  let [x, y, z] = v;
  let nx = x * cr - y * sr;
  let ny = x * sr + y * cr;
  let nz = z;
  [x, y, z] = [nx, ny, nz];
  ny = y * ct - z * st;
  nz = y * st + z * ct;
  [x, y, z] = [x, ny, nz];
  nx = x * cp + z * sp;
  nz = -x * sp + z * cp;
  return [nx, ny, nz];
}

function randomUnitVector(rng: SeededRng): [number, number, number] {
  // Even distribution on unit sphere
  const u = rng.next();
  const v = rng.next();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const s = Math.sin(phi);
  return [s * Math.cos(theta), Math.cos(phi), s * Math.sin(theta)];
}

function randomRingDirection(
  rng: SeededRng,
  squash: number,
): [number, number, number] {
  const angle = rng.next() * Math.PI * 2;
  return [Math.sin(angle) * squash, Math.cos(angle), 0];
}

function randomConeVector(
  rng: SeededRng,
  axis: [number, number, number],
  spreadRad: number,
): [number, number, number] {
  // Sample around +axis within cone, then return
  const cosA = Math.cos(rng.next() * spreadRad);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const phi = rng.next() * Math.PI * 2;
  const local: [number, number, number] = [
    sinA * Math.cos(phi),
    cosA,
    sinA * Math.sin(phi),
  ];
  // Build orthonormal basis around axis
  const [ax, ay, az] = axis;
  const upDot = ay;
  const len = Math.hypot(ax, ay, az) || 1;
  const nx = ax / len;
  const ny = ay / len;
  const nz = az / len;
  // pick a "right" vector
  let rx = 0;
  let ry = 0;
  let rz = 1;
  if (Math.abs(upDot) > 0.95) {
    rx = 1;
    ry = 0;
    rz = 0;
  }
  // r = right × axis
  const ux = ry * nz - rz * ny;
  const uy = rz * nx - rx * nz;
  const uz = rx * ny - ry * nx;
  const ulen = Math.hypot(ux, uy, uz) || 1;
  const Ux = ux / ulen;
  const Uy = uy / ulen;
  const Uz = uz / ulen;
  // V = axis × U
  const Vx = ny * Uz - nz * Uy;
  const Vy = nz * Ux - nx * Uz;
  const Vz = nx * Uy - ny * Ux;
  return [
    Ux * local[0] + nx * local[1] + Vx * local[2],
    Uy * local[0] + ny * local[1] + Vy * local[2],
    Uz * local[0] + nz * local[1] + Vz * local[2],
  ];
}

function dragApprox(age: number, drag: number): number {
  const k = (1 - drag) * 3;
  if (k < 1e-4) return age;
  return (1 - Math.exp(-age * k)) / k;
}

function evaluatePosition(
  origin: [number, number, number],
  velocity: [number, number, number],
  acceleration: [number, number, number],
  drag: number,
  age: number,
): [number, number, number] {
  const k = dragApprox(age, drag);
  return [
    origin[0] + velocity[0] * k + 0.5 * acceleration[0] * age * age,
    origin[1] + velocity[1] * k + 0.5 * acceleration[1] * age * age,
    origin[2] + velocity[2] * k + 0.5 * acceleration[2] * age * age,
  ];
}

function evaluateVelocity(
  velocity: [number, number, number],
  acceleration: [number, number, number],
  drag: number,
  age: number,
): [number, number, number] {
  const decay = Math.exp(-age * (1 - drag) * 3);
  return [
    velocity[0] * decay + acceleration[0] * age,
    velocity[1] * decay + acceleration[1] * age,
    velocity[2] * decay + acceleration[2] * age,
  ];
}

function deriveStarCount(spec: FireworkSpec): number {
  if (spec.starCount) return Math.min(MAX_STARS_PER_BURST, Math.round(spec.starCount));
  const density = spec.starDensity ?? 1;
  const scaledSize = spec.spreadSize / 4;
  const count = Math.max(8, Math.round(scaledSize * scaledSize * density * 12));
  return Math.min(MAX_STARS_PER_BURST, count);
}

function liftSeconds(spec: FireworkSpec): number {
  return Math.max(0.6, 0.6 + Math.sqrt(spec.spreadSize) * 0.18);
}

function alphaCurveFor(spec: FireworkSpec): number {
  if (spec.shellType === "strobe" || spec.strobe) return 3;
  if (spec.glitter && spec.glitter !== "none") return 4;
  if (spec.shellType === "willow" || spec.shellType === "fallingLeaves") return 5;
  if (spec.shellType === "comet") return 1;
  return 1;
}

function emissiveFor(spec: FireworkSpec): number {
  if (spec.shellType === "ghost") return 1.6;
  if (spec.shellType === "comet") return 3;
  return 2.4;
}

function strobeFreqFor(spec: FireworkSpec): number {
  if (spec.shellType === "strobe" || spec.strobe) return 18;
  return 0;
}

function starSizeFor(spec: FireworkSpec): { start: number; end: number } {
  const base = 0.22 + spec.spreadSize * 0.024;
  const tail =
    spec.shellType === "willow" || spec.shellType === "fallingLeaves"
      ? base * 0.6
      : base * 0.38;
  return { start: base, end: tail };
}

function cuePosition(cue: ReplayCue): [number, number, number] {
  const p = cue.positionMeters ?? { x: 0, y: 0, z: 0 };
  return [p.x, GROUND_Y + Math.max(2, p.y + spreadRise(cue)), p.z];
}

function spreadRise(cue: ReplayCue): number {
  const spec = safeParseFireworkSpec(cue.firework.spec);
  return Math.max(2.4, 1.4 + spec.spreadSize * 0.45);
}

function applyRotation(
  cue: ReplayCue,
  vec: [number, number, number],
): [number, number, number] {
  const r = cue.rotation ?? { pan: 0, tilt: 90, roll: 0 };
  return rotateVec(vec, r.pan, r.tilt, r.roll);
}

function pushStar(
  events: CompiledEffectEvent[],
  partial: Omit<CompiledStarEvent, "kind" | "id" | "cueId" | "expiresAt"> & {
    cue: ReplayCue;
    label: string;
  },
): void {
  const expiresAt = partial.time + partial.lifetime + 0.2;
  events.push({
    kind: "star",
    id: `${partial.cue.id}:${partial.label}`,
    cueId: partial.cue.id,
    time: partial.time,
    expiresAt,
    origin: partial.origin,
    velocity: partial.velocity,
    acceleration: partial.acceleration,
    drag: partial.drag,
    lifetime: partial.lifetime,
    sizeStart: partial.sizeStart,
    sizeEnd: partial.sizeEnd,
    color: partial.color,
    secondColor: partial.secondColor,
    transitionAt: partial.transitionAt,
    strobeFreq: partial.strobeFreq,
    emissive: partial.emissive,
    alphaCurve: partial.alphaCurve,
    seed: partial.seed,
    target: partial.target,
  });
}

function emitGlitter(
  events: CompiledEffectEvent[],
  cue: ReplayCue,
  parent: {
    origin: [number, number, number];
    velocity: [number, number, number];
    acceleration: [number, number, number];
    drag: number;
    lifetime: number;
    spawnTime: number;
  },
  glitter: GlitterKind | undefined,
  glitterColor: FireworkColor,
  rng: SeededRng,
  label: string,
): void {
  if (!glitter || glitter === "none") return;
  const profile = GLITTER_PROFILES[glitter];
  const sparkLifeSec = profile.sparkLifeMs / 1000;
  const sparksOverLifetime = Math.min(
    MAX_SPARKS_PER_STAR,
    Math.round((profile.sparkFreq / 1000) * parent.lifetime * 1000 / 60),
  );
  if (sparksOverLifetime <= 0) return;
  for (let i = 0; i < sparksOverLifetime; i++) {
    const emitAge = (i / sparksOverLifetime) * parent.lifetime * (0.2 + 0.8 * rng.next());
    const pos = evaluatePosition(
      parent.origin,
      parent.velocity,
      parent.acceleration,
      parent.drag,
      emitAge,
    );
    const vel = evaluateVelocity(
      parent.velocity,
      parent.acceleration,
      parent.drag,
      emitAge,
    );
    const dir = randomUnitVector(rng);
    const speed = profile.sparkSpeed;
    const sparkLife =
      sparkLifeSec * (1 + rng.signed(profile.sparkLifeVariation * 0.3));
    pushStar(events, {
      cue,
      label: `${label}:spark${i}`,
      time: parent.spawnTime + emitAge,
      origin: pos,
      velocity: [
        vel[0] + dir[0] * speed,
        vel[1] + dir[1] * speed,
        vel[2] + dir[2] * speed,
      ],
      acceleration: [0, GRAVITY, 0],
      drag: SPARK_DRAG,
      lifetime: Math.max(0.2, sparkLife),
      sizeStart: 0.06,
      sizeEnd: 0.02,
      color: glitterColor,
      secondColor: null,
      transitionAt: null,
      strobeFreq: 0,
      emissive: 2.6,
      alphaCurve: 4,
      seed: Math.floor(rng.next() * 1e6),
      target: "trails",
    });
  }
}

function emitDeathSparks(
  events: CompiledEffectEvent[],
  cue: ReplayCue,
  parent: {
    origin: [number, number, number];
    velocity: [number, number, number];
    acceleration: [number, number, number];
    drag: number;
    lifetime: number;
    spawnTime: number;
  },
  spec: FireworkSpec,
  rng: SeededRng,
  label: string,
): void {
  const deathTime = parent.spawnTime + parent.lifetime;
  const pos = evaluatePosition(
    parent.origin,
    parent.velocity,
    parent.acceleration,
    parent.drag,
    parent.lifetime,
  );
  const baseVel = evaluateVelocity(
    parent.velocity,
    parent.acceleration,
    parent.drag,
    parent.lifetime,
  );

  if (spec.crackle) {
    for (let i = 0; i < 18; i++) {
      const dir = randomUnitVector(rng);
      const speed = 1.5 + rng.next() * 1.4;
      pushStar(events, {
        cue,
        label: `${label}:crackle${i}`,
        time: deathTime,
        origin: pos,
        velocity: [
          baseVel[0] + dir[0] * speed,
          baseVel[1] + dir[1] * speed,
          baseVel[2] + dir[2] * speed,
        ],
        acceleration: [0, GRAVITY, 0],
        drag: SPARK_DRAG,
        lifetime: 0.45 + rng.next() * 0.25,
        sizeStart: 0.07,
        sizeEnd: 0.02,
        color: FIREWORK_COLORS.Gold,
        secondColor: null,
        transitionAt: null,
        strobeFreq: 0,
        emissive: 3,
        alphaCurve: 4,
        seed: Math.floor(rng.next() * 1e6),
        target: "trails",
      });
    }
  }

  if (spec.crossette) {
    for (let i = 0; i < 4; i++) {
      const dir = randomUnitVector(rng);
      const speed = 2.4;
      pushStar(events, {
        cue,
        label: `${label}:cross${i}`,
        time: deathTime,
        origin: pos,
        velocity: [
          baseVel[0] + dir[0] * speed,
          baseVel[1] + dir[1] * speed,
          baseVel[2] + dir[2] * speed,
        ],
        acceleration: [0, GRAVITY, 0],
        drag: STAR_DRAG,
        lifetime: 0.55,
        sizeStart: 0.13,
        sizeEnd: 0.05,
        color:
          spec.color === "random" || Array.isArray(spec.color)
            ? FIREWORK_COLORS.White
            : (spec.color as FireworkColor),
        secondColor: null,
        transitionAt: null,
        strobeFreq: 0,
        emissive: 2.6,
        alphaCurve: 1,
        seed: Math.floor(rng.next() * 1e6),
        target: "particles",
      });
    }
  }

  if (spec.floral || spec.fallingLeaves) {
    const count = spec.floral ? 6 : 8;
    for (let i = 0; i < count; i++) {
      const dir = randomUnitVector(rng);
      const speed = spec.floral ? 1.6 : 0.7;
      pushStar(events, {
        cue,
        label: `${label}:floral${i}`,
        time: deathTime,
        origin: pos,
        velocity: [
          baseVel[0] + dir[0] * speed,
          baseVel[1] + dir[1] * speed * 0.3,
          baseVel[2] + dir[2] * speed,
        ],
        acceleration: [0, GRAVITY * 0.55, 0],
        drag: HEAVY_DRAG,
        lifetime: 1.6,
        sizeStart: 0.14,
        sizeEnd: 0.06,
        color: FIREWORK_COLORS.Gold,
        secondColor: null,
        transitionAt: null,
        strobeFreq: 0,
        emissive: 2.4,
        alphaCurve: 5,
        seed: Math.floor(rng.next() * 1e6),
        target: "particles",
      });
    }
  }
}

function emitBurst(
  events: CompiledEffectEvent[],
  cue: ReplayCue,
  burstPos: [number, number, number],
  spec: FireworkSpec,
  primaryColor: FireworkColor,
  burstTime: number,
  rng: SeededRng,
  scale: number,
  prefix: string,
): void {
  events.push({
    kind: "flash",
    id: `${cue.id}:${prefix}:flash`,
    cueId: cue.id,
    time: burstTime,
    expiresAt: burstTime + 0.18,
    origin: burstPos,
    color:
      spec.color === "random" || Array.isArray(spec.color)
        ? FIREWORK_COLORS.White
        : primaryColor,
    size: spec.spreadSize * 0.08 * scale,
    seed: Math.floor(rng.next() * 1e6),
  });

  const starCount = deriveStarCount(spec);
  const burstSpeed = spec.spreadSize * 0.7;
  const starLifeSec = spec.starLifeMs / 1000;
  const starLifeVariation = spec.starLifeVariation ?? 0.125;
  const ringSquash = spec.ring ? 0.18 + rng.next() * 0.5 : 1;
  const horseAxis = spec.horsetail
    ? applyRotation(cue, [0, -1, 0])
    : null;
  const sizes = starSizeFor(spec);
  const colorChoice = (i: number): FireworkColor => {
    if (Array.isArray(spec.color)) return spec.color[i % 2];
    if (spec.color === "random") return pickPrimaryColor(spec, () => rng.next());
    return spec.color;
  };

  for (let i = 0; i < starCount; i++) {
    let dir: [number, number, number];
    if (spec.ring) {
      const ringDir = randomRingDirection(rng, ringSquash);
      dir = applyRotation(cue, ringDir);
    } else if (spec.horsetail && horseAxis) {
      dir = randomConeVector(rng, horseAxis, Math.PI * 0.55);
    } else {
      dir = randomUnitVector(rng);
    }
    const speedJitter = 0.85 + rng.next() * 0.3;
    const velocity: [number, number, number] = [
      dir[0] * burstSpeed * speedJitter,
      dir[1] * burstSpeed * speedJitter,
      dir[2] * burstSpeed * speedJitter,
    ];
    const lifetime =
      starLifeSec * (1 + rng.signed(starLifeVariation));
    const color = colorChoice(i);
    const secondColor =
      spec.secondColor ?? (spec.shellType === "ghost" ? null : null);
    const transitionAt =
      spec.transitionTimeMs && spec.secondColor
        ? burstTime + spec.transitionTimeMs / 1000
        : null;
    pushStar(events, {
      cue,
      label: `${prefix}:star${i}`,
      time: burstTime,
      origin: burstPos,
      velocity,
      acceleration: [0, GRAVITY, 0],
      drag: spec.shellType === "willow" || spec.shellType === "fallingLeaves" ? HEAVY_DRAG : STAR_DRAG,
      lifetime,
      sizeStart: sizes.start,
      sizeEnd: sizes.end,
      color,
      secondColor: secondColor ?? null,
      transitionAt,
      strobeFreq: strobeFreqFor(spec),
      emissive: emissiveFor(spec),
      alphaCurve: alphaCurveFor(spec),
      seed: Math.floor(rng.next() * 1e6),
      target: "particles",
    });

    emitGlitter(
      events,
      cue,
      {
        origin: burstPos,
        velocity,
        acceleration: [0, GRAVITY, 0],
        drag: STAR_DRAG,
        lifetime,
        spawnTime: burstTime,
      },
      spec.glitter,
      spec.glitterColor ?? color,
      rng,
      `${prefix}:gl${i}`,
    );

    emitDeathSparks(
      events,
      cue,
      {
        origin: burstPos,
        velocity,
        acceleration: [0, GRAVITY, 0],
        drag: STAR_DRAG,
        lifetime,
        spawnTime: burstTime,
      },
      spec,
      rng,
      `${prefix}:dth${i}`,
    );
  }

  if (spec.pistil) {
    const pistilColor = spec.pistilColor ?? FIREWORK_COLORS.Gold;
    const pistilSpec: FireworkSpec = {
      ...spec,
      shellType: "crysanthemum",
      color: pistilColor,
      pistil: false,
      streamers: false,
      ring: false,
      horsetail: false,
      crossette: false,
      crackle: false,
      floral: false,
      fallingLeaves: false,
      strobe: false,
      glitter: "light",
      glitterColor:
        pistilColor === FIREWORK_COLORS.Gold
          ? FIREWORK_COLORS.Gold
          : FIREWORK_COLORS.White,
      spreadSize: spec.spreadSize * 0.5,
      starLifeMs: spec.starLifeMs * 0.65,
      starCount: undefined,
      starDensity: 1.4,
    };
    emitBurst(
      events,
      cue,
      burstPos,
      pistilSpec,
      pistilColor,
      burstTime,
      rng,
      scale,
      `${prefix}:pist`,
    );
  }

  if (spec.streamers) {
    const streamerSpec: FireworkSpec = {
      ...spec,
      shellType: "crysanthemum",
      color: FIREWORK_COLORS.White,
      pistil: false,
      streamers: false,
      ring: false,
      horsetail: false,
      crossette: false,
      crackle: false,
      floral: false,
      fallingLeaves: false,
      strobe: false,
      glitter: "streamer",
      glitterColor: FIREWORK_COLORS.White,
      spreadSize: spec.spreadSize * 0.9,
      starLifeMs: spec.starLifeMs * 0.85,
      starCount: Math.max(6, Math.round(spec.spreadSize * 1.4)),
      starDensity: undefined,
    };
    emitBurst(
      events,
      cue,
      burstPos,
      streamerSpec,
      FIREWORK_COLORS.White,
      burstTime,
      rng,
      scale,
      `${prefix}:str`,
    );
  }
}

export function compileCueEvents(cue: ReplayCue): CompiledEffectEvent[] {
  const events: CompiledEffectEvent[] = [];
  const spec = safeParseFireworkSpec(cue.firework.spec) ?? DEFAULT_FIREWORK_SPEC;
  const seed = cue.seedOverride ?? mixSeed(cue.id, cue.firework.id);
  const rng = createSeededRng(seed);
  const scale = cue.scale ?? 1;
  const burstPos = cuePosition(cue);
  const lift = liftSeconds(spec);
  // All shells launch from a single mortar at stage centre; bursts still occur
  // at the cued 3D position for variety.
  const launchPos: [number, number, number] = [0, GROUND_Y, 0];

  // Lift comet
  const liftDelta: [number, number, number] = [
    burstPos[0] - launchPos[0],
    burstPos[1] - launchPos[1],
    burstPos[2] - launchPos[2],
  ];
  const liftVelocity: [number, number, number] = [
    liftDelta[0] / lift,
    liftDelta[1] / lift - 0.5 * GRAVITY * lift,
    liftDelta[2] / lift,
  ];
  const cometColor =
    spec.color === "random" || Array.isArray(spec.color)
      ? FIREWORK_COLORS.Gold
      : (spec.color as FireworkColor);

  pushStar(events, {
    cue,
    label: "lift",
    time: cue.timeSeconds,
    origin: launchPos,
    velocity: liftVelocity,
    acceleration: [0, GRAVITY, 0],
    drag: HEAVY_DRAG,
    lifetime: lift,
    sizeStart: 0.18,
    sizeEnd: 0.1,
    color: cometColor,
    secondColor: null,
    transitionAt: null,
    strobeFreq: 0,
    emissive: 3.2,
    alphaCurve: 1,
    seed: Math.floor(rng.next() * 1e6),
    target: "particles",
  });

  emitGlitter(
    events,
    cue,
    {
      origin: launchPos,
      velocity: liftVelocity,
      acceleration: [0, GRAVITY, 0],
      drag: HEAVY_DRAG,
      lifetime: lift,
      spawnTime: cue.timeSeconds,
    },
    "medium",
    cometColor,
    rng,
    "lift:tail",
  );

  // Burst
  const primaryColor = pickPrimaryColor(spec, () => rng.next());
  const burstTime = cue.timeSeconds + lift;

  if (spec.shellType === "comet") {
    // Comet shells just keep going as the lift trail; skip a normal burst.
    return events;
  }

  emitBurst(
    events,
    cue,
    burstPos,
    spec,
    primaryColor,
    burstTime,
    rng,
    scale,
    "burst",
  );

  return events;
}

export function eventIsActiveAt(
  event: CompiledEffectEvent,
  elapsed: number,
): boolean {
  return event.time <= elapsed && elapsed <= event.expiresAt;
}

const TMP = new THREE.Color();

function colorTuple(color: FireworkColor): [number, number, number] {
  return hexToRgb(color);
}

export function emitCompiledEvent(
  event: CompiledEffectEvent,
  targets: EngineEmitTargets,
): void {
  if (event.kind === "flash") {
    const rgb = colorTuple(event.color);
    targets.particles.write({
      origin: event.origin,
      velocity: [0, 0, 0],
      acceleration: [0, 0, 0],
      spawnTime: event.time,
      lifetime: 0.18,
      sizeStart: event.size * 1.1,
      sizeEnd: event.size * 0.4,
      colorStart: [1, 1, 1],
      colorMid: rgb,
      colorEnd: rgb,
      alphaStart: 1,
      alphaMid: 0.6,
      alphaEnd: 0,
      drag: 0.1,
      twinkleFrequency: 0,
      twinkleAmount: 0,
      strobeFrequency: 0,
      strobeDutyCycle: 0,
      emissiveIntensity: 6,
      alphaCurve: 1,
      seed: event.seed,
    });
    return;
  }
  const rgb = colorTuple(event.color);
  const secondaryRgb = event.secondColor ? colorTuple(event.secondColor) : rgb;
  const transitionT = event.transitionAt
    ? Math.min(1, Math.max(0, (event.transitionAt - event.time) / event.lifetime))
    : 1;
  const target = event.target === "trails" ? targets.trails : targets.particles;
  void TMP;
  void transitionT;
  target.write({
    origin: event.origin,
    velocity: event.velocity,
    acceleration: event.acceleration,
    spawnTime: event.time,
    lifetime: event.lifetime,
    sizeStart: event.sizeStart,
    sizeEnd: event.sizeEnd,
    colorStart: rgb,
    colorMid: rgb,
    colorEnd: secondaryRgb,
    alphaStart: 1,
    alphaMid: 0.92,
    alphaEnd: 0,
    drag: event.drag,
    twinkleFrequency: 6,
    twinkleAmount: 0.08,
    strobeFrequency: event.strobeFreq,
    strobeDutyCycle: event.strobeFreq > 0 ? 0.18 : 0,
    emissiveIntensity: event.emissive,
    alphaCurve: event.alphaCurve,
    seed: event.seed,
  });
}
