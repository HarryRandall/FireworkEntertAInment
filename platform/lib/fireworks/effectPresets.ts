import {
  FireworkEffectSpecV2Schema,
  type BreakSpec,
  type FireworkEffectSpecV2,
  type LaunchSpec,
  type ParticleLayerSpec,
  type ShotSpec,
} from "@/lib/fireworks/spec-v2";

type ShellPresetInput = {
  id: string;
  name: string;
  description: string;
  seed: number;
  type?: FireworkEffectSpecV2["type"];
  burstType: BreakSpec["burstType"];
  shape: BreakSpec["shape"];
  colors: string[];
  heightMeters?: number;
  durationSeconds?: number;
  layers: ParticleLayerSpec[];
  smokeAmount?: number;
  comments: string;
};

function gradient(colors: string[], fadeColor = colors[colors.length - 1] ?? "#FFFFFF") {
  return [
    { t: 0, color: "#FFFFFF", alpha: 1 },
    { t: 0.18, color: colors[0] ?? "#FFFFFF", alpha: 1 },
    { t: 0.62, color: colors[1] ?? colors[0] ?? "#FFFFFF", alpha: 0.85 },
    { t: 1, color: fadeColor, alpha: 0 },
  ];
}

function starLayer(
  id: string,
  role: ParticleLayerSpec["role"],
  colors: string[],
  options: Partial<{
    count: number;
    distribution: ParticleLayerSpec["distribution"]["type"];
    speedMin: number;
    speedMax: number;
    gravity: number;
    drag: number;
    lifetimeMin: number;
    lifetimeMax: number;
    sizeStart: number;
    sizeEnd: number;
    alphaCurve: ParticleLayerSpec["appearance"]["alphaCurve"];
    twinkle: number;
    twinkleAmount: number;
    strobe: number;
    strobeDuty: number;
    trailLength: number;
    trailSegments: number;
    glitter: number;
    verticalBias: number;
    polarMin: number;
    polarMax: number;
    angleStart: number;
    angleEnd: number;
    symmetry: number;
    crackleBursts: number;
    childParticleCount: number;
    spawnDelaySeconds: number;
    spawnDurationSeconds: number;
  }> = {},
): ParticleLayerSpec {
  const trailLength = options.trailLength ?? 0.45;
  return {
    id,
    enabled: true,
    role,
    particleCount: options.count ?? 520,
    spawnMode: options.spawnDurationSeconds ? "burst_over_time" : "instant",
    spawnDelaySeconds: options.spawnDelaySeconds ?? 0,
    spawnDurationSeconds: options.spawnDurationSeconds ?? 0,
    distribution: {
      type: options.distribution ?? "shell",
      radius: 1,
      thickness: 0.18,
      verticalBias: options.verticalBias ?? 0,
      horizontalBias: 0,
      angleStart: options.angleStart,
      angleEnd: options.angleEnd,
      polarMin: options.polarMin,
      polarMax: options.polarMax,
      noiseAmount: 0.07,
      symmetry: options.symmetry ?? 0,
    },
    velocity: {
      speedMin: options.speedMin ?? 18,
      speedMax: options.speedMax ?? 34,
      radialSpeed: 1,
      tangentialSpeed: 0.18,
      upwardBias: 0.03,
      downwardBias: options.gravity && options.gravity < -10 ? 0.18 : 0.05,
      inheritedLaunchVelocity: 0.025,
      turbulence: 0.06,
      curl: 0.03,
      drag: options.drag ?? 0.84,
      gravity: options.gravity ?? -8.4,
      windScale: 0.2,
    },
    lifetime: {
      min: options.lifetimeMin ?? 1.6,
      max: options.lifetimeMax ?? 2.8,
      fadeIn: 0.02,
      fadeOut: 0.7,
      random: 0.22,
    },
    appearance: {
      texture: "spark_core",
      sizeStart: options.sizeStart ?? 8,
      sizeEnd: options.sizeEnd ?? 1,
      sizeRandomness: 0.28,
      sizeAttenuation: true,
      colorGradient: gradient(colors),
      emissiveIntensity: role === "glitter" || role === "strobe" ? 3.5 : 2.8,
      alphaCurve: options.alphaCurve ?? "spark_flicker",
      temperatureShift: 0,
      twinkleFrequency: options.twinkle ?? 10,
      twinkleAmount: options.twinkleAmount ?? 0.14,
      strobeFrequency: options.strobe ?? 0,
      strobeDutyCycle: options.strobeDuty ?? 0.45,
      sparkleNoise: options.glitter ?? 0.18,
    },
    trail: {
      enabled: trailLength > 0,
      type: trailLength > 0.75 ? "spark_spawn" : "afterimage",
      lengthSeconds: trailLength,
      segmentCount: options.trailSegments ?? Math.round(trailLength * 9),
      widthStart: Math.max(1.1, (options.sizeStart ?? 8) * 0.38),
      widthEnd: 0,
      alphaDecay: 0.78,
      colorInheritsParticle: true,
      glitter: options.glitter ?? 0.12,
      fragmentation: (options.glitter ?? 0) * 0.25,
    },
    events: {
      crossetteSplit: role === "secondary_stars" && id.includes("crossette"),
      crackleBursts: options.crackleBursts ?? 0,
      secondaryBurstProbability: 0,
      splitTime: options.crackleBursts ? 0.85 : undefined,
      splitCount: 0,
      childParticleCount: options.childParticleCount ?? 0,
    },
    blending: {
      mode: "additive",
      depthWrite: false,
      depthTest: true,
      renderOrder: role === "secondary_stars" ? 21 : 20,
    },
    lod: {
      minQuality: "low",
      maxDistance: 10_000,
      particleBudgetWeight: role === "primary_stars" ? 1 : 0.55,
    },
  };
}

function smoke(amount = 0.28) {
  return {
    enabled: amount > 0,
    amount,
    particleCount: Math.round(80 * amount),
    color: "#6B665D",
    opacity: 0.16,
    size: 12,
    riseSpeed: 0.75,
    expansion: 1.65,
    windScale: 0.8,
    turbulence: 0.5,
    lifetime: 5.2,
    fadeIn: 0.45,
    fadeOut: 2.8,
    texture: "smoke_puff" as const,
    depthSoftening: 0.5,
  };
}

function launch(colors: string[], heightMeters = 88): LaunchSpec {
  return {
    enabled: true,
    liftTimeSeconds: 1.15,
    startPosition: { x: 0, y: 0, z: 0 },
    endHeightMeters: heightMeters,
    launchVelocity: heightMeters / 1.15,
    arcAmount: 0.04,
    gravity: -9.8,
    drag: 0.96,
    tracerColor: colors[0] ?? "#FFD36A",
    tracerSize: 4.5,
    tracerLifetime: 0.65,
    tracerTrailLength: 0.45,
    tracerSparkRate: 30,
    tracerSparkSize: 2.6,
    tracerSmokeAmount: 0.16,
    liftFlashSize: 8,
    liftFlashColor: "#FFE8A3",
    randomWobble: 0.035,
    windInfluence: 0.16,
  };
}

function makeBreak(input: ShellPresetInput): BreakSpec {
  return {
    enabled: true,
    timeOffsetSeconds: 1.15,
    burstType: input.burstType,
    shape: input.shape,
    layers: input.layers,
    flash: {
      enabled: true,
      color: input.colors[0] ?? "#FFFFFF",
      intensity: 3.5,
      size: 14,
      duration: 0.08,
      bloomMultiplier: 1.8,
    },
    shockwave: { enabled: true, strength: 0.08 },
    smoke: smoke(input.smokeAmount ?? 0.28),
    subBreaks: [],
    reports: [{ kind: "break", loudness: 0.7 }],
    randomness: { shellManufacturingVariance: 0.08 },
    rotation: { pan: 0, tilt: 90, roll: 0 },
    scale: 1,
    colorPhases: input.colors.map((color, index) => ({
      t: index / Math.max(1, input.colors.length - 1),
      color,
    })),
  };
}

function shellPreset(input: ShellPresetInput): FireworkEffectSpecV2 {
  const heightMeters = input.heightMeters ?? 88;
  const mainBreak = makeBreak(input);
  return FireworkEffectSpecV2Schema.parse({
    id: input.id,
    version: 2,
    name: input.name,
    description: input.description,
    source: "catalogue",
    confidence: 1,
    seed: input.seed,
    type: input.type ?? "shell",
    globalScale: 0.045,
    durationSeconds: input.durationSeconds ?? 4.6,
    prefireSeconds: 0,
    heightMeters,
    colorPalette: input.colors,
    renderProfile: {
      quality: "high",
      maxParticles: 120_000,
      maxTrailSegments: 240_000,
      useGPUShaders: true,
      useBloom: true,
      useHDR: true,
      useSmoke: true,
      usePostFX: true,
      pixelRatioLimit: 2,
      lodDistanceScale: 1,
      deterministic: true,
      debugMode: false,
    },
    launch: launch(input.colors, heightMeters),
    shotSequence: {
      shotCount: 1,
      durationSeconds: 0,
      cadenceMode: "custom",
      firingPattern: "STR",
      rowCount: 1,
      tubesPerRow: 1,
      rowSpacing: 0,
      tubeSpacing: 0,
      angleRangeDegrees: 0,
      fanAngles: [],
      volleyGroups: [],
      timingJitterSeconds: 0,
      symmetryJitter: 0.02,
      manufacturingVariation: 0.06,
      shots: [
        {
          index: 0,
          timeOffsetSeconds: 0,
          launchPositionOffset: { x: 0, y: 0, z: 0 },
          panDegrees: 0,
          tiltDegrees: 90,
          rollDegrees: 0,
          launchHeightMeters: heightMeters,
          liftTimeSeconds: 1.15,
          breakSpec: mainBreak,
          seedOffset: 0,
          confidence: 1,
        },
      ],
    },
    effectLayers: input.layers,
    audio: {
      events: [
        { timeSeconds: 0, kind: "launch", confidence: 0.9 },
        { timeSeconds: 1.15, kind: "burst", confidence: 0.95 },
      ],
      gain: 1,
    },
    cameraHints: { targetHeightMeters: heightMeters * 0.55 },
    metadata: {
      comments: input.comments,
      editableParameters: [
        "particleCount",
        "colors",
        "burstType",
        "shape",
        "shotCount",
        "cadence",
        "fanAngle",
        "height",
        "duration",
        "trailLength",
        "gravity",
        "drag",
        "wind",
        "glitter",
        "strobe",
        "crackle",
        "smoke",
        "bloom",
        "quality",
        "seed",
      ],
    },
  });
}

function cloneBreak(base: BreakSpec): BreakSpec {
  return structuredClone(base) as BreakSpec;
}

function cakePreset(input: {
  id: string;
  name: string;
  description: string;
  seed: number;
  colors: string[];
  shotCount: number;
  durationSeconds: number;
  firingPattern: FireworkEffectSpecV2["shotSequence"]["firingPattern"];
  cadenceMode: FireworkEffectSpecV2["shotSequence"]["cadenceMode"];
  fanAngles: number[];
  layer: ParticleLayerSpec;
  comments: string;
}): FireworkEffectSpecV2 {
  const breakSpec = makeBreak({
    id: input.id,
    name: input.name,
    description: input.description,
    seed: input.seed,
    type: "cake",
    burstType: "peony",
    shape: input.fanAngles.length ? "fan" : "sphere",
    colors: input.colors,
    heightMeters: 58,
    durationSeconds: input.durationSeconds + 3.5,
    layers: [input.layer],
    smokeAmount: 0.22,
    comments: input.comments,
  });
  const shots: ShotSpec[] = Array.from({ length: input.shotCount }, (_, index) => {
    const normalized = input.shotCount <= 1 ? 0 : index / (input.shotCount - 1);
    const angle =
      input.fanAngles[index % input.fanAngles.length] ??
      (normalized - 0.5) * 28;
    const zipperDelay =
      input.cadenceMode === "zipper"
        ? normalized * input.durationSeconds
        : (index / input.shotCount) * input.durationSeconds;
    return {
      index,
      timeOffsetSeconds: zipperDelay,
      launchPositionOffset: { x: (normalized - 0.5) * 7, y: 0, z: 0 },
      panDegrees: angle,
      tiltDegrees: 78 + Math.abs(angle) * 0.12,
      rollDegrees: 0,
      launchHeightMeters: 48 + Math.abs(angle) * 0.7,
      liftTimeSeconds: 0.82,
      breakSpec: { ...cloneBreak(breakSpec), timeOffsetSeconds: 0.82 },
      seedOffset: index * 97,
      confidence: 1,
    };
  });
  return FireworkEffectSpecV2Schema.parse({
    id: input.id,
    version: 2,
    name: input.name,
    description: input.description,
    source: "catalogue",
    confidence: 1,
    seed: input.seed,
    type: "cake",
    globalScale: 0.045,
    durationSeconds: input.durationSeconds + 3.2,
    prefireSeconds: 0,
    heightMeters: 64,
    colorPalette: input.colors,
    renderProfile: {
      quality: "high",
      maxParticles: 120_000,
      maxTrailSegments: 260_000,
      useGPUShaders: true,
      useBloom: true,
      useHDR: true,
      useSmoke: true,
      usePostFX: true,
      pixelRatioLimit: 1.8,
      lodDistanceScale: 1,
      deterministic: true,
      debugMode: false,
    },
    launch: launch(input.colors, 58),
    shotSequence: {
      shotCount: input.shotCount,
      durationSeconds: input.durationSeconds,
      cadenceMode: input.cadenceMode,
      firingPattern: input.firingPattern,
      rowCount: Math.max(1, Math.ceil(input.shotCount / 8)),
      tubesPerRow: Math.min(8, input.shotCount),
      rowSpacing: 0.32,
      tubeSpacing: 0.24,
      angleRangeDegrees: input.fanAngles.length
        ? Math.max(...input.fanAngles) - Math.min(...input.fanAngles)
        : 28,
      fanAngles: input.fanAngles,
      volleyGroups: [],
      timingJitterSeconds: 0.015,
      symmetryJitter: 0.05,
      manufacturingVariation: 0.08,
      shots,
    },
    effectLayers: [input.layer],
    audio: { events: shots.map((shot) => ({ timeSeconds: shot.timeOffsetSeconds, kind: "launch", confidence: 0.8 })), gain: 1 },
    cameraHints: { targetHeightMeters: 32, suggestedDistanceMeters: 90 },
    metadata: { comments: input.comments },
  });
}

export const fireworkEffectPresetsV2: FireworkEffectSpecV2[] = [
  shellPreset({
    id: "preset-red-peony",
    name: "Red Peony",
    description: "Classic red spherical shell with a short hot core and soft trailing embers.",
    seed: 1001,
    burstType: "peony",
    shape: "sphere",
    colors: ["#ff3b2f", "#ff9a7a", "#3a0402"],
    layers: [starLayer("red-peony-stars", "primary_stars", ["#ff3b2f", "#ff9a7a", "#3a0402"], { count: 720, trailLength: 0.42 })],
    comments: "Baseline shell preset for tuning colour, spread, trail length, and bloom.",
  }),
  shellPreset({
    id: "preset-blue-peony-silver-glitter",
    name: "Blue Peony with Silver Glitter",
    description: "Blue peony stars with a delayed silver glitter layer.",
    seed: 1002,
    burstType: "glitter",
    shape: "sphere",
    colors: ["#4aa3ff", "#dbeafe", "#ffffff"],
    layers: [
      starLayer("blue-peony-stars", "primary_stars", ["#4aa3ff", "#8fd5ff", "#06285f"], { count: 620, trailLength: 0.35 }),
      starLayer("silver-glitter", "glitter", ["#ffffff", "#dbeafe", "#aab7c7"], { count: 260, speedMin: 10, speedMax: 20, spawnDelaySeconds: 0.16, trailLength: 0.8, glitter: 0.65, alphaCurve: "glitter_decay", twinkle: 28, twinkleAmount: 0.5 }),
    ],
    comments: "Use the secondary glitter layer for products advertised as titanium or silver glitter.",
  }),
  shellPreset({
    id: "preset-gold-chrysanthemum",
    name: "Gold Chrysanthemum",
    description: "Dense gold chrysanthemum with fine spokes and long warm decay.",
    seed: 1003,
    burstType: "chrysanthemum",
    shape: "sphere",
    colors: ["#ffd36a", "#fff2b0", "#b56a18"],
    layers: [starLayer("gold-chrysanthemum-spokes", "primary_stars", ["#fff2b0", "#ffd36a", "#b56a18"], { count: 980, speedMin: 18, speedMax: 38, trailLength: 0.95, trailSegments: 10, glitter: 0.25, lifetimeMax: 3.4 })],
    comments: "High particle count and long trails sell the chrysanthemum spoke texture.",
  }),
  shellPreset({
    id: "preset-willow",
    name: "Willow",
    description: "Slow drooping gold willow with warm ember tails.",
    seed: 1004,
    burstType: "willow",
    shape: "willow_droop",
    colors: ["#ffd36a", "#c88932", "#3b1f0a"],
    durationSeconds: 6.2,
    layers: [starLayer("willow-droop-stars", "primary_stars", ["#ffe6a3", "#c88932", "#3b1f0a"], { count: 820, speedMin: 10, speedMax: 25, gravity: -15, drag: 0.72, lifetimeMin: 3.1, lifetimeMax: 5.2, trailLength: 1.7, trailSegments: 16, glitter: 0.18, verticalBias: -0.22 })],
    smokeAmount: 0.42,
    comments: "Long trail length plus stronger gravity creates the visible willow curtain.",
  }),
  shellPreset({
    id: "preset-brocade-crown",
    name: "Brocade Crown",
    description: "Heavy brocade shell with warm crown trails and subtle sparkle.",
    seed: 1005,
    burstType: "brocade",
    shape: "sphere",
    colors: ["#fff2b0", "#ffd36a", "#9c5a17"],
    durationSeconds: 5.8,
    layers: [starLayer("brocade-crown-stars", "primary_stars", ["#fff2b0", "#ffd36a", "#9c5a17"], { count: 900, speedMin: 15, speedMax: 30, gravity: -11.5, drag: 0.8, lifetimeMin: 2.8, lifetimeMax: 4.6, trailLength: 1.35, trailSegments: 13, glitter: 0.5, alphaCurve: "glitter_decay" })],
    comments: "Brocade uses moderate speed, warm colours, and long glittering afterimage trails.",
  }),
  shellPreset({
    id: "preset-palm",
    name: "Palm",
    description: "Palm shell with chunky fronds and a compact center flash.",
    seed: 1006,
    burstType: "palm",
    shape: "palm_fronds",
    colors: ["#ffc857", "#fff7d6", "#5c2d0c"],
    layers: [starLayer("palm-fronds", "primary_stars", ["#ffc857", "#fff7d6", "#5c2d0c"], { count: 260, symmetry: 7, speedMin: 20, speedMax: 35, trailLength: 1.15, trailSegments: 11, sizeStart: 12, gravity: -9.6 })],
    comments: "Low count with symmetry makes palm fronds read clearly instead of becoming a sphere.",
  }),
  shellPreset({
    id: "preset-ring-shell",
    name: "Ring Shell",
    description: "Single clean ring with faint center sparks.",
    seed: 1007,
    burstType: "ring",
    shape: "ring",
    colors: ["#ff4d6d", "#ffffff", "#42101a"],
    layers: [starLayer("ring-stars", "primary_stars", ["#ff4d6d", "#ffffff", "#42101a"], { count: 520, distribution: "ring", speedMin: 18, speedMax: 28, trailLength: 0.42, symmetry: 48 })],
    comments: "Ring presets rely on distribution more than particle count; keep trails restrained.",
  }),
  shellPreset({
    id: "preset-double-ring",
    name: "Double Ring",
    description: "Two concentric colour rings with staggered sizes.",
    seed: 1008,
    burstType: "double_ring",
    shape: "torus",
    colors: ["#ff3b2f", "#4aa3ff", "#ffffff"],
    layers: [
      starLayer("outer-red-ring", "primary_stars", ["#ff3b2f", "#ffb3a7", "#4a0503"], { count: 460, distribution: "ring", speedMin: 22, speedMax: 30, trailLength: 0.38, symmetry: 48 }),
      starLayer("inner-blue-ring", "secondary_stars", ["#4aa3ff", "#dbeafe", "#061f47"], { count: 340, distribution: "ring", speedMin: 13, speedMax: 18, trailLength: 0.25, symmetry: 36 }),
    ],
    comments: "Layer speed separation creates the concentric ring effect.",
  }),
  shellPreset({
    id: "preset-heart-shell",
    name: "Heart Shell",
    description: "Heart-shaped shell approximation with red stars and white glints.",
    seed: 1009,
    burstType: "heart",
    shape: "heart",
    colors: ["#ff2d55", "#ffffff", "#3d0714"],
    layers: [starLayer("heart-stars", "primary_stars", ["#ff2d55", "#ffffff", "#3d0714"], { count: 620, distribution: "custom", speedMin: 15, speedMax: 26, trailLength: 0.35 })],
    comments: "The renderer reserves custom point support; current preset falls back to seeded shaped spread.",
  }),
  shellPreset({
    id: "preset-crossette",
    name: "Crossette",
    description: "Bright stars split into smaller cross sparks.",
    seed: 1010,
    burstType: "crossette",
    shape: "sphere",
    colors: ["#ff7a18", "#fff2b0", "#ffffff"],
    layers: [starLayer("crossette-stars", "secondary_stars", ["#ff7a18", "#fff2b0", "#ffffff"], { count: 360, speedMin: 16, speedMax: 26, trailLength: 0.55, crackleBursts: 48, childParticleCount: 6 })],
    comments: "Crossette behaviour is modeled as deterministic delayed child sparks.",
  }),
  shellPreset({
    id: "preset-crackle-chrysanthemum",
    name: "Crackle Chrysanthemum",
    description: "Gold chrysanthemum with delayed crackle flowers.",
    seed: 1011,
    burstType: "crackle",
    shape: "sphere",
    colors: ["#ffd36a", "#ffffff", "#f97316"],
    layers: [starLayer("crackle-chrysanthemum", "primary_stars", ["#ffd36a", "#ffffff", "#f97316"], { count: 760, trailLength: 0.8, crackleBursts: 80, childParticleCount: 8, glitter: 0.25 })],
    comments: "Use crackleBursts to add small delayed child bursts without new React state.",
  }),
  shellPreset({
    id: "preset-strobe-shell",
    name: "Strobe Shell",
    description: "White strobe stars with hard on-off timing.",
    seed: 1012,
    burstType: "strobe",
    shape: "sphere",
    colors: ["#ffffff", "#e0f2fe", "#64748b"],
    layers: [starLayer("white-strobe-stars", "strobe", ["#ffffff", "#e0f2fe", "#64748b"], { count: 540, speedMin: 12, speedMax: 24, trailLength: 0.25, alphaCurve: "strobe", strobe: 16, strobeDuty: 0.34, lifetimeMax: 3.1 })],
    comments: "Strobe is shader-side; scrubbing preserves exact phase from seed and time.",
  }),
  shellPreset({
    id: "preset-falling-leaves",
    name: "Falling Leaves",
    description: "Slow drifting leaves with low gravity and wide soft fade.",
    seed: 1013,
    burstType: "falling_leaves",
    shape: "hemisphere",
    colors: ["#ffdf80", "#ff7a18", "#7c2d12"],
    durationSeconds: 6,
    layers: [starLayer("falling-leaves", "falling_leaves", ["#ffdf80", "#ff7a18", "#7c2d12"], { count: 360, speedMin: 4, speedMax: 13, gravity: -5.5, drag: 0.92, lifetimeMin: 3.2, lifetimeMax: 5.5, trailLength: 0.7, polarMin: 20, polarMax: 150 })],
    comments: "Lower speed and high drag make the drifting leaf motion distinct.",
  }),
  shellPreset({
    id: "preset-horsetail",
    name: "Horsetail",
    description: "Horsetail break spilling downward from a compact high point.",
    seed: 1014,
    burstType: "horsetail",
    shape: "willow_droop",
    colors: ["#ffd36a", "#f59e0b", "#3b1f0a"],
    durationSeconds: 5.7,
    layers: [starLayer("horsetail-streamers", "primary_stars", ["#ffd36a", "#f59e0b", "#3b1f0a"], { count: 430, speedMin: 5, speedMax: 15, gravity: -16, drag: 0.76, lifetimeMin: 3, lifetimeMax: 4.8, trailLength: 1.65, verticalBias: -0.55, polarMin: 70, polarMax: 180 })],
    comments: "Horsetail is intentionally asymmetric and downward biased.",
  }),
  shellPreset({
    id: "preset-fish-bees",
    name: "Fish/Bees",
    description: "Erratic fish-like moving stars with short bright wiggles.",
    seed: 1015,
    burstType: "bees",
    shape: "sphere",
    colors: ["#7dd3fc", "#ffffff", "#fef08a"],
    layers: [starLayer("fish-bees", "micro_sparks", ["#7dd3fc", "#ffffff", "#fef08a"], { count: 520, speedMin: 8, speedMax: 22, drag: 0.94, lifetimeMax: 2.4, trailLength: 0.32, glitter: 0.35, twinkle: 34, twinkleAmount: 0.45 })],
    comments: "Shader curl plus high twinkle creates the erratic fish/bees impression.",
  }),
  shellPreset({
    id: "preset-red-mine",
    name: "Red Mine",
    description: "Low fan mine of red stars fired from the ground.",
    seed: 1016,
    type: "mine",
    burstType: "mine",
    shape: "fan",
    colors: ["#ff3b2f", "#ffb4a8", "#3a0402"],
    heightMeters: 24,
    durationSeconds: 2.6,
    layers: [starLayer("red-mine-fan", "primary_stars", ["#ff3b2f", "#ffb4a8", "#3a0402"], { count: 420, distribution: "fan", speedMin: 12, speedMax: 26, gravity: -10, lifetimeMax: 1.8, trailLength: 0.45, angleStart: -38, angleEnd: 38 })],
    comments: "Mine effects use lower height and fan distribution for launch-level bursts.",
  }),
  shellPreset({
    id: "preset-gold-comet",
    name: "Gold Comet",
    description: "Single gold comet with persistent launch trail and no large break.",
    seed: 1017,
    type: "comet",
    burstType: "comet_only",
    shape: "cone",
    colors: ["#ffd36a", "#fff2b0", "#b56a18"],
    heightMeters: 58,
    durationSeconds: 3,
    layers: [starLayer("gold-comet-head", "comets", ["#fff2b0", "#ffd36a", "#b56a18"], { count: 90, distribution: "cone", speedMin: 4, speedMax: 10, gravity: -7, lifetimeMax: 1.6, sizeStart: 13, trailLength: 1.25, trailSegments: 12 })],
    comments: "A comet is represented as a compact break plus a strong tracer trail.",
  }),
  shellPreset({
    id: "preset-mine-to-peony",
    name: "Mine to Peony",
    description: "Red mine at launch followed by a blue peony shell break.",
    seed: 1018,
    type: "combo",
    burstType: "peony",
    shape: "sphere",
    colors: ["#ff3b2f", "#4aa3ff", "#ffffff"],
    layers: [starLayer("mine-to-peony-blue", "primary_stars", ["#4aa3ff", "#ffffff", "#061f47"], { count: 660, trailLength: 0.45 })],
    comments: "Combo preset for products with both ground mine and aerial break components.",
  }),
  cakePreset({
    id: "preset-fanned-cake",
    name: "Fanned Cake",
    description: "Nine-shot fanned cake with alternating red, gold, and blue peonies.",
    seed: 1019,
    colors: ["#ff3b2f", "#ffd36a", "#4aa3ff"],
    shotCount: 9,
    durationSeconds: 5.4,
    firingPattern: "FNR",
    cadenceMode: "even",
    fanAngles: [-28, -20, -12, -6, 0, 6, 12, 20, 28],
    layer: starLayer("fanned-cake-stars", "primary_stars", ["#ff3b2f", "#ffd36a", "#4aa3ff"], { count: 320, trailLength: 0.42, speedMin: 12, speedMax: 24 }),
    comments: "Shot sequence, fanAngles, and offsets represent the cake; it is not one huge burst.",
  }),
  cakePreset({
    id: "preset-zipper-cake",
    name: "Zipper Cake",
    description: "Fast left-to-right zipper cake with glitter tails.",
    seed: 1020,
    colors: ["#4aa3ff", "#ffffff", "#ffd36a"],
    shotCount: 16,
    durationSeconds: 4.2,
    firingPattern: "Z_SHAPE",
    cadenceMode: "zipper",
    fanAngles: [-32, -24, -16, -8, 0, 8, 16, 24, 32, 24, 16, 8, 0, -8, -16, -24],
    layer: starLayer("zipper-glitter-stars", "glitter", ["#4aa3ff", "#ffffff", "#ffd36a"], { count: 220, trailLength: 0.75, glitter: 0.6, speedMin: 10, speedMax: 20 }),
    comments: "Cadence mode zipper creates sequential lateral motion for show-builder previews.",
  }),
  cakePreset({
    id: "preset-w-shape-cake",
    name: "W-Shape Cake",
    description: "W-pattern cake with simultaneous mini volleys.",
    seed: 1021,
    colors: ["#ffd36a", "#ff3b2f", "#ffffff"],
    shotCount: 15,
    durationSeconds: 6,
    firingPattern: "W_SHAPE",
    cadenceMode: "volleys",
    fanAngles: [-28, -12, 0, 12, 28],
    layer: starLayer("w-cake-stars", "primary_stars", ["#ffd36a", "#ff3b2f", "#ffffff"], { count: 260, trailLength: 0.52, speedMin: 11, speedMax: 23 }),
    comments: "W pattern uses repeated fan angles across rows and remains deterministic when scrubbed.",
  }),
  cakePreset({
    id: "preset-reloadable-shell-kit",
    name: "Reloadable Shell Kit Sequence",
    description: "Six distinct reloadable-style shells fired in a steady sequence.",
    seed: 1022,
    colors: ["#ff3b2f", "#4aa3ff", "#ffd36a", "#ffffff"],
    shotCount: 6,
    durationSeconds: 12,
    firingPattern: "STR",
    cadenceMode: "even",
    fanAngles: [0],
    layer: starLayer("reloadable-kit-stars", "primary_stars", ["#ff3b2f", "#4aa3ff", "#ffd36a"], { count: 640, trailLength: 0.7, speedMin: 17, speedMax: 32 }),
    comments: "Represents reloadables as a shot timeline with per-shot seeds, not as one composite burst.",
  }),
  cakePreset({
    id: "preset-finale-volley",
    name: "Finale Volley",
    description: "Dense simultaneous volley with mixed colour chrysanthemums and crackle.",
    seed: 1023,
    colors: ["#ff3b2f", "#ffd36a", "#4aa3ff", "#ffffff"],
    shotCount: 24,
    durationSeconds: 3.2,
    firingPattern: "CENTER_OUT",
    cadenceMode: "volleys",
    fanAngles: [-30, -18, -8, 0, 8, 18, 30],
    layer: starLayer("finale-volley-stars", "primary_stars", ["#ff3b2f", "#ffd36a", "#4aa3ff"], { count: 420, trailLength: 0.65, speedMin: 16, speedMax: 34, crackleBursts: 24, childParticleCount: 8 }),
    comments: "High overlap tests particle budgets, bloom, and deterministic scrub rebuilds.",
  }),
  cakePreset({
    id: "preset-lace-glitter-cake",
    name: "Lace + Glitter Cake",
    description: "Elegant cake with lace-like white breaks and gold glitter curtains.",
    seed: 1024,
    colors: ["#ffffff", "#ffd36a", "#9c5a17"],
    shotCount: 18,
    durationSeconds: 8.5,
    firingPattern: "OUTSIDE_IN",
    cadenceMode: "accelerando",
    fanAngles: [-24, -16, -8, 0, 8, 16, 24],
    layer: starLayer("lace-glitter-stars", "glitter", ["#ffffff", "#ffd36a", "#9c5a17"], { count: 300, trailLength: 1.1, glitter: 0.72, alphaCurve: "glitter_decay", speedMin: 10, speedMax: 22 }),
    comments: "Good stress case for overlapping glitter trails and long transparent decay.",
  }),
];

export const fireworkEffectPresetById = new Map(
  fireworkEffectPresetsV2.map((preset) => [preset.id, preset]),
);
