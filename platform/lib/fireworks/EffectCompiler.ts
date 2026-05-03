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
  type FireworkSpec,
  type GlitterKind,
} from "@/lib/fireworks/spec";

const GROUND_Y = -1.45;
const CENTER_XZ: [number, number] = [0, 0];
// Keep gravity much softer than real-world scale. The burst should leave the
// shell quickly, then hang and drift down rather than visibly dropping like debris.
const GRAVITY = -0.42;
// Per-second drag coefficient. Matches the shader's `(1 - drag) * 3` time constant.
// With drag=0.60, tau = 1 / ((1-0.6)*3) = 0.83 s — particles decelerate to 37 % of
// their launch speed in under a second, giving the characteristic "shoot then float"
// look rather than flying outward in straight lines until death.
const STAR_DRAG = 0.6;
const SPARK_DRAG = 0.45;
// Heavy drag is for the lifting comet, which needs to stay "heavy" and keep rising.
const HEAVY_DRAG = 0.9;
const MAX_SPARKS_PER_STAR = 54;
const MAX_STARS_PER_BURST = 720;
const HANG_TIME_MULTIPLIER = 1.45;
const HEIGHT_METERS_TO_SCENE = 1 / 20;

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
  color: string;
  secondColor: string | null;
  colorStart: [number, number, number] | null;
  colorMid: [number, number, number] | null;
  transitionAt: number | null;
  alphaStart: number;
  alphaMid: number;
  alphaEnd: number;
  strobeFreq: number;
  strobeDutyCycle: number;
  twinkleFrequency: number;
  twinkleAmount: number;
  spinRadius: number;
  spinSpeed: number;
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
  color: string;
  size: number;
  alphaStart?: number;
  alphaMid?: number;
  emissive?: number;
  alphaCurve?: number;
  seed: number;
};

export type CompiledEffectEvent = CompiledStarEvent | CompiledFlashEvent;

const DEG2RAD = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

function normalizeVec(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function bloomDirection(
  index: number,
  count: number,
  rng: SeededRng,
): [number, number, number] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - ((index + 0.5) / Math.max(1, count)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = index * goldenAngle + rng.signed(0.08);
  const base: [number, number, number] = [
    Math.cos(theta) * radius,
    y,
    Math.sin(theta) * radius,
  ];
  const jitter = randomUnitVector(rng);
  return normalizeVec([
    base[0] + jitter[0] * 0.045,
    base[1] + jitter[1] * 0.045,
    base[2] + jitter[2] * 0.045,
  ]);
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
  const dragK = Math.max(0.0001, (1 - drag) * 3);
  const k = dragApprox(age, drag);
  return [
    origin[0] + velocity[0] * k + acceleration[0] * (age - k) / dragK,
    origin[1] + velocity[1] * k + acceleration[1] * (age - k) / dragK,
    origin[2] + velocity[2] * k + acceleration[2] * (age - k) / dragK,
  ];
}

function evaluateVelocity(
  velocity: [number, number, number],
  acceleration: [number, number, number],
  drag: number,
  age: number,
): [number, number, number] {
  const dragK = Math.max(0.0001, (1 - drag) * 3);
  const decay = Math.exp(-age * dragK);
  const accelTerm = (1 - decay) / dragK;
  return [
    velocity[0] * decay + acceleration[0] * accelTerm,
    velocity[1] * decay + acceleration[1] * accelTerm,
    velocity[2] * decay + acceleration[2] * accelTerm,
  ];
}

function deriveStarCount(spec: FireworkSpec): number {
  if (spec.starCount) return Math.min(MAX_STARS_PER_BURST, Math.round(spec.starCount));
  const density = spec.starDensity ?? 1;
  // Exemplar uses (spreadSize_px / 54)² × density, giving ~150 stars at spreadSize=600px.
  // Our spreadSize is in metres; a direct square gets us equivalent density —
  // spreadSize=4.6 → ~148 stars, which is what a firework cloud should look like.
  const count = Math.max(36, Math.round(spec.spreadSize * spec.spreadSize * density * 10));
  return Math.min(MAX_STARS_PER_BURST, count);
}

function scaleSpecForCue(spec: FireworkSpec, scale: number): FireworkSpec {
  const clamped = clamp(Number.isFinite(scale) ? scale : 1, 0.35, 1.6);
  const starCount = spec.starCount
    ? Math.max(4, Math.round(spec.starCount * clamped * clamped))
    : undefined;
  return {
    ...spec,
    spreadSize: clamp(spec.spreadSize * clamped, 0.4, 40),
    starCount,
  };
}

function uniqueColors(colors: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const color of colors) {
    if (!color || seen.has(color)) continue;
    seen.add(color);
    out.push(color);
  }
  return out;
}

function paletteForSpec(spec: FireworkSpec): string[] {
  const colorChoice = spec.color;
  const palette = uniqueColors([
    spec.outerColor,
    ...(spec.colorPalette ?? []),
    Array.isArray(colorChoice) ? colorChoice[0] : colorChoice === "random" ? null : colorChoice,
    Array.isArray(colorChoice) ? colorChoice[1] : null,
    spec.secondColor,
  ]);
  if (!palette.length) return [FIREWORK_COLORS.Gold];
  if (spec.pistil && spec.pistilColor && palette.length > 1) {
    const outer = palette.filter((color) => color !== spec.pistilColor);
    if (outer.length) return outer;
  }
  return palette;
}

function colorForStar(spec: FireworkSpec, index: number): string {
  const palette = paletteForSpec(spec);
  return palette[index % palette.length] ?? FIREWORK_COLORS.Gold;
}

function liftColorFor(spec: FireworkSpec): string {
  return (
    spec.tailColor ??
    spec.launch?.tailColor ??
    spec.launch?.tracerColor ??
    spec.glitterColor ??
    (spec.color === "random" || Array.isArray(spec.color)
      ? FIREWORK_COLORS.Gold
      : spec.color)
  );
}

function liftGlitterFor(spec: FireworkSpec): GlitterKind | undefined {
  if (spec.trailEffect === "none") return "none";
  if (spec.trailEffect === "crackle") return "heavy";
  if (spec.trailEffect === "silver" || spec.trailEffect === "gold") return "streamer";
  if (spec.shellType === "comet") return spec.glitter ?? "streamer";
  return "streamer";
}

function heightMultiplierFor(spec: FireworkSpec): number {
  if (spec.shellType === "comet") return 0.58;
  if (spec.shellType === "horsetail") return 0.66;
  if (spec.shellType === "fallingLeaves") return 0.72;
  if (spec.shellType === "willow") return 0.88;
  if (spec.shellType === "palm") return 0.92;
  if (spec.shellType === "ring") return 1.08;
  if (spec.shellType === "strobe" || spec.strobe) return 1.22;
  return 1;
}

function durationMultiplierFor(spec: FireworkSpec): number {
  if (spec.shellType === "crackle" || spec.crackle) return 0.78;
  if (spec.shellType === "crossette" || spec.crossette) return 0.92;
  if (spec.shellType === "ring" || spec.ring) return 1.08;
  if (spec.shellType === "strobe" || spec.strobe) return 1.22;
  if (spec.shellType === "willow") return 1.45;
  if (spec.shellType === "fallingLeaves" || spec.fallingLeaves) return 1.7;
  return 1;
}

function liftSeconds(spec: FireworkSpec, height: number): number {
  const explicitLift = spec.liftTimeSeconds ?? spec.launch?.liftTimeSeconds;
  if (explicitLift != null && Number.isFinite(explicitLift)) {
    return clamp(explicitLift, 0.35, 4);
  }
  const shellLift =
    spec.shellType === "comet" || spec.shellType === "horsetail" ? 0.72 : 1;
  return Math.max(0.65, (0.55 + Math.sqrt(height) * 0.3) * shellLift);
}

function visualDurationSeconds(cue: ReplayCue, spec: FireworkSpec): number | null {
  const duration = cue.firework.durationSeconds;
  if (duration == null || !Number.isFinite(duration)) return null;
  const minDuration = spec.shellType === "comet" ? 1.2 : 1.8;
  return clamp(duration, minDuration, 12);
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

function strobeDutyCycleFor(spec: FireworkSpec): number {
  if (spec.shellType === "strobe" || spec.strobe) return 0.34;
  return 0;
}

function starSizeFor(spec: FireworkSpec): { start: number; end: number } {
  const base = 0.3 + spec.spreadSize * 0.034;
  const tail =
    spec.shellType === "willow" || spec.shellType === "fallingLeaves"
      ? base * 0.6
      : base * 0.38;
  return { start: base, end: tail };
}

function cuePosition(cue: ReplayCue): [number, number, number] {
  const p = cue.positionMeters ?? { x: 0, y: 0, z: 0 };
  const spec = safeParseFireworkSpec(cue.firework.spec);
  const seed = mixSeed(cue.id, `${cue.firework.id}:height`);
  const rng = createSeededRng(seed);
  const variation = 0.94 + rng.next() * 0.14;
  const catalogueHeight =
    cue.firework.heightMeters == null || !Number.isFinite(cue.firework.heightMeters)
      ? spreadRise(cue)
      : cue.firework.heightMeters * HEIGHT_METERS_TO_SCENE;
  const specHeight =
    spec.launch?.heightMeters == null || !Number.isFinite(spec.launch.heightMeters)
      ? catalogueHeight
      : spec.launch.heightMeters * HEIGHT_METERS_TO_SCENE;
  const height = Math.max(
    1.7,
    (p.y + specHeight) * heightMultiplierFor(spec) * variation,
  );
  return [p.x + CENTER_XZ[0], GROUND_Y + height, p.z + CENTER_XZ[1]];
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
  partial: Omit<
    CompiledStarEvent,
    | "kind"
    | "id"
    | "cueId"
    | "expiresAt"
    | "colorStart"
    | "colorMid"
    | "alphaStart"
    | "alphaMid"
    | "alphaEnd"
    | "strobeDutyCycle"
    | "twinkleFrequency"
    | "twinkleAmount"
    | "spinRadius"
    | "spinSpeed"
  > &
    Partial<
      Pick<
        CompiledStarEvent,
        | "colorStart"
        | "colorMid"
        | "alphaStart"
        | "alphaMid"
        | "alphaEnd"
        | "strobeDutyCycle"
        | "twinkleFrequency"
        | "twinkleAmount"
        | "spinRadius"
        | "spinSpeed"
      >
    > & {
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
    colorStart: partial.colorStart ?? null,
    colorMid: partial.colorMid ?? null,
    transitionAt: partial.transitionAt,
    alphaStart: partial.alphaStart ?? 1,
    alphaMid: partial.alphaMid ?? 0.55,
    alphaEnd: partial.alphaEnd ?? 0,
    strobeFreq: partial.strobeFreq,
    strobeDutyCycle: partial.strobeDutyCycle ?? 0,
    twinkleFrequency: partial.twinkleFrequency ?? 6,
    twinkleAmount: partial.twinkleAmount ?? 0.08,
    spinRadius: partial.spinRadius ?? 0,
    spinSpeed: partial.spinSpeed ?? 0,
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
  glitterColor: string,
  rng: SeededRng,
  label: string,
): void {
  if (!glitter || glitter === "none") return;
  const profile = GLITTER_PROFILES[glitter];
  const sparkLifeSec = (profile.sparkLifeMs / 1000) * 1.35;
  const sparksOverLifetime = Math.min(
    MAX_SPARKS_PER_STAR,
    Math.round((parent.lifetime * 1000) / Math.max(16, profile.sparkFreq)),
  );
  if (sparksOverLifetime <= 0) return;
  const step = parent.lifetime / sparksOverLifetime;
  for (let i = 0; i < sparksOverLifetime; i++) {
    const emitAge = Math.min(parent.lifetime * 0.98, (i + rng.next() * 0.8) * step);
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
      twinkleFrequency: 10,
      twinkleAmount: 0.14,
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
    const startAngle = rng.next() * Math.PI * 0.5;
    for (let i = 0; i < 4; i++) {
      const angle = startAngle + (i / 4) * Math.PI * 2 + rng.signed(0.08);
      const dir = applyRotation(cue, [Math.sin(angle), Math.cos(angle), 0]);
      const speed = 1.9 + rng.next() * 0.7;
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
        color: colorForStar(spec, i),
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

function emitRipple(
  events: CompiledEffectEvent[],
  cue: ReplayCue,
  burstPos: [number, number, number],
  spec: FireworkSpec,
  color: string,
  burstTime: number,
  rng: SeededRng,
  prefix: string,
): void {
  if (spec.shellType === "horsetail" || spec.shellType === "comet") return;
  const count = spec.ring ? 28 : 44;
  const radiusSpeed = spec.spreadSize * (spec.ring ? 0.45 : 0.34);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng.signed(0.025);
    const wobble = rng.signed(0.12);
    pushStar(events, {
      cue,
      label: `${prefix}:ripple${i}`,
      time: burstTime + 0.08 + rng.next() * 0.08,
      origin: burstPos,
      velocity: [
        Math.cos(angle) * radiusSpeed,
        wobble,
        Math.sin(angle) * radiusSpeed,
      ],
      acceleration: [0, GRAVITY * 0.25, 0],
      drag: 0.72,
      lifetime: 1.05 + rng.next() * 0.55,
      sizeStart: 0.08 + spec.spreadSize * 0.008,
      sizeEnd: 0.018,
      color,
      secondColor: null,
      transitionAt: null,
      strobeFreq: 0,
      emissive: 1.2,
      alphaCurve: 2,
      seed: Math.floor(rng.next() * 1e6),
      target: "trails",
    });
  }
}

function emitBurst(
  events: CompiledEffectEvent[],
  cue: ReplayCue,
  burstPos: [number, number, number],
  spec: FireworkSpec,
  primaryColor: string,
  burstTime: number,
  rng: SeededRng,
  scale: number,
  prefix: string,
  maxLifeSeconds?: number,
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
    size: spec.spreadSize * 0.22 * scale,
    alphaStart: 0.72,
    alphaMid: 0.3,
    emissive: 4.5,
    seed: Math.floor(rng.next() * 1e6),
  });

  events.push({
    kind: "flash",
    id: `${cue.id}:${prefix}:local-glow`,
    cueId: cue.id,
    time: burstTime + 0.02,
    expiresAt: burstTime + 1.25,
    origin: burstPos,
    color: primaryColor,
    size: spec.spreadSize * 0.9 * scale,
    alphaStart: 0.2,
    alphaMid: 0.08,
    emissive: 1.65,
    alphaCurve: 1,
    seed: Math.floor(rng.next() * 1e6),
  });

  const starCount = deriveStarCount(spec);
  // spreadSize is the final cloud DIAMETER (exemplar convention). Asymptotic radius
  // under drag is burstSpeed × tau; with tau=0.83s we want burstSpeed ≈ spreadSize/2/tau
  // ≈ 0.6 × spreadSize. Particles die before asymptote so we nudge slightly up.
  const burstSpeed = spec.spreadSize * 0.64;
  // Small upward bias so the burst shape stays visually centered as gravity pulls
  // the cloud down during hang time. Matches the exemplar's `standardInitialSpeed`.
  const burstRise = spec.spreadSize * 0.08;
  const naturalStarLifeSec =
    (spec.starLifeMs / 1000) *
    HANG_TIME_MULTIPLIER *
    durationMultiplierFor(spec) *
    (0.9 + rng.next() * 0.2);
  const starLifeSec =
    maxLifeSeconds == null
      ? naturalStarLifeSec
      : clamp(naturalStarLifeSec, 0.45, Math.max(0.45, maxLifeSeconds));
  const starLifeVariation = spec.starLifeVariation ?? 0.125;
  const ringSquash = spec.ring ? 0.18 + rng.next() * 0.5 : 1;
  const horseAxis = spec.horsetail
    ? applyRotation(cue, [0, -1, 0])
    : null;
  const sizes = starSizeFor(spec);
  for (let i = 0; i < starCount; i++) {
    let dir: [number, number, number];
    if (spec.ring) {
      const ringDir = randomRingDirection(rng, ringSquash);
      dir = applyRotation(cue, ringDir);
    } else if (spec.horsetail && horseAxis) {
      dir = randomConeVector(rng, horseAxis, Math.PI * 0.55);
    } else {
      dir = bloomDirection(i, starCount, rng);
    }
    // Near-cubic falloff on the speed multiplier places more stars toward the
    // outer edge of the sphere. Without this, the inner cloud looks too dense and
    // the outer shell too thin — the exemplar uses the same technique.
    const speedJitter = Math.pow(rng.next(), 0.45) * 0.18 + 0.9;
    const velocity: [number, number, number] = [
      dir[0] * burstSpeed * speedJitter,
      dir[1] * burstSpeed * speedJitter + (spec.horsetail ? 0 : burstRise),
      dir[2] * burstSpeed * speedJitter,
    ];
    const lifetime = Math.max(
      0.5,
      starLifeSec * (1 + rng.signed(starLifeVariation)),
    );
    const color = colorForStar(spec, i);
    const secondColor =
      spec.secondColor ?? (spec.shellType === "ghost" ? null : null);
    const transitionAt =
      spec.transitionTimeMs && spec.secondColor
        ? burstTime + spec.transitionTimeMs / 1000
        : spec.shellType === "ghost"
          ? burstTime + lifetime * (0.34 + rng.next() * 0.08)
        : null;
    const ghostColor =
      spec.shellType === "ghost"
        ? ([0, 0, 0] as [number, number, number])
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
      colorStart: ghostColor,
      colorMid: ghostColor,
      transitionAt,
      alphaStart: spec.shellType === "ghost" ? 0.02 : 1,
      alphaMid: spec.shellType === "ghost" ? 0.82 : 0.55,
      strobeFreq: strobeFreqFor(spec),
      strobeDutyCycle: strobeDutyCycleFor(spec),
      twinkleFrequency: spec.shellType === "strobe" || spec.strobe ? 0 : 6,
      twinkleAmount: spec.shellType === "strobe" || spec.strobe ? 0 : 0.08,
      emissive: emissiveFor(spec),
      alphaCurve: alphaCurveFor(spec),
      seed: Math.floor(rng.next() * 1e6),
      target: "particles",
    });

    if (!spec.ring && !spec.horsetail && i % 2 === 0) {
      pushStar(events, {
        cue,
        label: `${prefix}:trail${i}`,
        time: burstTime,
        origin: burstPos,
        velocity: [
          velocity[0] * 0.82,
          velocity[1] * 0.82,
          velocity[2] * 0.82,
        ],
        acceleration: [0, GRAVITY, 0],
        drag: STAR_DRAG,
        lifetime: lifetime * 0.82,
        sizeStart: sizes.start * 0.46,
        sizeEnd: Math.max(0.025, sizes.end * 0.32),
        color,
        secondColor: secondColor ?? null,
        transitionAt,
        strobeFreq: 0,
        twinkleFrequency: 4,
        twinkleAmount: 0.06,
        emissive: 1.55,
        alphaCurve: 2,
        seed: Math.floor(rng.next() * 1e6),
        target: "trails",
      });
    }

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

  emitRipple(events, cue, burstPos, spec, primaryColor, burstTime, rng, prefix);

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
      maxLifeSeconds == null ? undefined : maxLifeSeconds * 0.65,
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
      maxLifeSeconds == null ? undefined : maxLifeSeconds * 0.85,
    );
  }
}

function compileShotSequenceCueEvents(
  cue: ReplayCue,
  baseSpec: FireworkSpec,
  baseSeed: number,
): CompiledEffectEvent[] {
  const shots = baseSpec.shots ?? [];
  const basePosition = cue.positionMeters ?? { x: 0, y: 0, z: 0 };
  const baseRotation = cue.rotation ?? { pan: 0, tilt: 90, roll: 0 };
  const events: CompiledEffectEvent[] = [];

  shots.forEach((shot, index) => {
    const shotIndex = shot.index ?? index;
    const shotSpec: FireworkSpec = {
      ...baseSpec,
      shots: undefined,
      color: shot.color ?? baseSpec.color,
      colorPalette: shot.colorPalette ?? baseSpec.colorPalette,
      pistilColor: shot.pistilColor ?? baseSpec.pistilColor,
      tailColor: shot.tailColor ?? baseSpec.tailColor,
      liftTimeSeconds: shot.liftTimeSeconds ?? baseSpec.liftTimeSeconds,
      launch: {
        ...(baseSpec.launch ?? {}),
        liftTimeSeconds:
          shot.liftTimeSeconds ??
          baseSpec.launch?.liftTimeSeconds ??
          baseSpec.liftTimeSeconds,
        heightMeters:
          shot.heightMeters ??
          baseSpec.launch?.heightMeters ??
          cue.firework.heightMeters ??
          undefined,
      },
    };
    const position = shot.position ?? {};
    const shotCue: ReplayCue = {
      ...cue,
      id: `${cue.id}:shot${shotIndex}`,
      position: cue.position + shotIndex / 1000,
      timeSeconds: cue.timeSeconds + shot.timeOffsetSeconds,
      positionMeters: {
        x: basePosition.x + (position.x ?? 0),
        y: basePosition.y + (position.y ?? 0),
        z: basePosition.z + (position.z ?? 0),
      },
      rotation: {
        pan: shot.panDegrees ?? baseRotation.pan,
        tilt: shot.tiltDegrees ?? baseRotation.tilt,
        roll: baseRotation.roll,
      },
      scale: (cue.scale ?? 1) * (shot.scale ?? 1),
      seedOverride: baseSeed + (shot.seedOffset ?? shotIndex * 101),
      firework: {
        ...cue.firework,
        id: `${cue.firework.id}:shot${shotIndex}`,
        heightMeters:
          shot.heightMeters ??
          cue.firework.heightMeters ??
          baseSpec.launch?.heightMeters ??
          null,
        spec: shotSpec,
      },
    };
    events.push(...compileCueEvents(shotCue));
  });

  return events;
}

export function compileCueEvents(cue: ReplayCue): CompiledEffectEvent[] {
  const events: CompiledEffectEvent[] = [];
  const baseSpec = safeParseFireworkSpec(cue.firework.spec) ?? DEFAULT_FIREWORK_SPEC;
  const seed = cue.seedOverride ?? mixSeed(cue.id, cue.firework.id);
  if (baseSpec.shots?.length) {
    return compileShotSequenceCueEvents(cue, baseSpec, seed);
  }
  const rng = createSeededRng(seed);
  const scale = cue.scale ?? 1;
  const spec = scaleSpecForCue(baseSpec, scale);
  const visualDuration = visualDurationSeconds(cue, spec);
  const burstPos = cuePosition(cue);
  const lift = liftSeconds(spec, burstPos[1] - GROUND_Y);
  const liftLifetime =
    spec.shellType === "comet"
      ? Math.max(lift, visualDuration ?? lift + spec.starLifeMs / 1000)
      : lift;
  // Mortar sits directly below the burst point so shells rise vertically.
  const launchPos: [number, number, number] = [burstPos[0], GROUND_Y, burstPos[2]];

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
    liftColorFor(spec);

  pushStar(events, {
    cue,
    label: "lift",
    time: cue.timeSeconds,
    origin: launchPos,
    velocity: liftVelocity,
    acceleration: [0, GRAVITY, 0],
    drag: HEAVY_DRAG,
    lifetime: liftLifetime,
    sizeStart: spec.shellType === "comet" ? 0.16 : 0.14,
    sizeEnd: spec.shellType === "comet" ? 0.06 : 0.05,
    color: cometColor,
    secondColor: null,
    transitionAt: null,
    strobeFreq: 0,
    twinkleFrequency: 18,
    twinkleAmount: 0.18,
    spinRadius: spec.shellType === "comet" ? 0.055 : 0.035,
    spinSpeed: spec.shellType === "comet" ? 9.5 : 7,
    emissive: 3.2,
    alphaCurve: 1,
    seed: Math.floor(rng.next() * 1e6),
    target: "particles",
  });

  events.push({
    kind: "flash",
    id: `${cue.id}:lift:flash`,
    cueId: cue.id,
    time: cue.timeSeconds,
    expiresAt: cue.timeSeconds + 0.12,
    origin: launchPos,
    color: cometColor,
    size: Math.max(0.32, spec.spreadSize * 0.08),
    seed: Math.floor(rng.next() * 1e6),
  });

  emitGlitter(
    events,
    cue,
    {
      origin: launchPos,
      velocity: liftVelocity,
      acceleration: [0, GRAVITY, 0],
      drag: HEAVY_DRAG,
      lifetime: liftLifetime,
      spawnTime: cue.timeSeconds,
    },
    liftGlitterFor(spec),
    spec.glitterColor ?? cometColor,
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
  const maxBurstLife =
    visualDuration == null ? undefined : Math.max(0.45, visualDuration - lift - 0.2);

  emitBurst(
    events,
    cue,
    burstPos,
    spec,
    primaryColor,
    burstTime,
    rng,
    1,
    "burst",
    maxBurstLife,
  );

  return events;
}

export function eventIsActiveAt(
  event: CompiledEffectEvent,
  elapsed: number,
): boolean {
  return event.time <= elapsed && elapsed <= event.expiresAt;
}

function colorTuple(color: string): [number, number, number] {
  return hexToRgb(color);
}

export function emitCompiledEvent(
  event: CompiledEffectEvent,
  targets: EngineEmitTargets,
): void {
  if (event.kind === "flash") {
    const rgb = colorTuple(event.color);
    const lifetime = Math.max(0.05, event.expiresAt - event.time);
    targets.particles.write({
      origin: event.origin,
      velocity: [0, 0, 0],
      acceleration: [0, 0, 0],
      spawnTime: event.time,
      lifetime,
      sizeStart: event.size * 1.1,
      sizeEnd: event.size * 0.4,
      colorStart: [1, 1, 1],
      colorMid: rgb,
      colorEnd: rgb,
      alphaStart: event.alphaStart ?? 1,
      alphaMid: event.alphaMid ?? 0.6,
      alphaEnd: 0,
      drag: 0.1,
      colorTransition: 0.45,
      twinkleFrequency: 0,
      twinkleAmount: 0,
      strobeFrequency: 0,
      strobeDutyCycle: 0,
      spinRadius: 0,
      spinSpeed: 0,
      emissiveIntensity: event.emissive ?? 6,
      alphaCurve: event.alphaCurve ?? 1,
      seed: event.seed,
    });
    return;
  }
  const rgb = colorTuple(event.color);
  const secondaryRgb = event.secondColor ? colorTuple(event.secondColor) : rgb;
  const transitionT = event.transitionAt
    ? Math.min(1, Math.max(0, (event.transitionAt - event.time) / event.lifetime))
    : 1;
  const startRgb = event.colorStart ?? rgb;
  const midRgb = event.colorMid ?? rgb;
  const target = event.target === "trails" ? targets.trails : targets.particles;
  target.write({
    origin: event.origin,
    velocity: event.velocity,
    acceleration: event.acceleration,
    spawnTime: event.time,
    lifetime: event.lifetime,
    sizeStart: event.sizeStart,
    sizeEnd: event.sizeEnd,
    colorStart: startRgb,
    colorMid: midRgb,
    colorEnd: secondaryRgb,
    alphaStart: event.alphaStart,
    alphaMid: event.alphaMid,
    alphaEnd: event.alphaEnd,
    drag: event.drag,
    colorTransition: transitionT,
    twinkleFrequency: event.twinkleFrequency,
    twinkleAmount: event.twinkleAmount,
    strobeFrequency: event.strobeFreq,
    strobeDutyCycle: event.strobeDutyCycle,
    spinRadius: event.spinRadius,
    spinSpeed: event.spinSpeed,
    emissiveIntensity: event.emissive,
    alphaCurve: event.alphaCurve,
    seed: event.seed,
  });
}
