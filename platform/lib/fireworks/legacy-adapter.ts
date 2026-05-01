import type { FireworkRenderParams, FireworkRenderSpec } from "@/lib/shows";
import type {
  BreakSpec,
  FireworkEffectSpecV2,
  ParticleLayerSpec,
} from "@/lib/fireworks/spec-v2";
import { FireworkEffectSpecV2Schema } from "@/lib/fireworks/spec-v2";

const DEFAULT_LEGACY_COLORS = ["#00E5FF", "#8B5CF6", "#FF3DF2"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mergeLegacySpec(
  spec: FireworkRenderSpec,
  overrides?: FireworkRenderParams | null,
): FireworkRenderSpec {
  return {
    ...spec,
    ...(overrides ?? {}),
    colors:
      overrides?.colors && overrides.colors.length > 0
        ? overrides.colors
        : spec.colors,
  };
}

function gradientFromColors(colors: string[]): ParticleLayerSpec["appearance"]["colorGradient"] {
  const palette = colors.length > 0 ? colors : DEFAULT_LEGACY_COLORS;
  if (palette.length === 1) {
    return [
      { t: 0, color: "#FFFFFF", alpha: 1 },
      { t: 0.18, color: palette[0], alpha: 1 },
      { t: 1, color: palette[0], alpha: 0 },
    ];
  }
  return [
    { t: 0, color: "#FFFFFF", alpha: 1 },
    { t: 0.22, color: palette[0], alpha: 1 },
    { t: 0.72, color: palette[1] ?? palette[0], alpha: 0.75 },
    { t: 1, color: palette[palette.length - 1] ?? palette[0], alpha: 0 },
  ];
}

function legacyPrimaryLayer(spec: FireworkRenderSpec): ParticleLayerSpec {
  const palette = spec.colors.length > 0 ? spec.colors : DEFAULT_LEGACY_COLORS;
  const trailLength = clamp(spec.trailLength, 0, 2.5);
  return {
    id: "legacy-primary-stars",
    enabled: true,
    role: "primary_stars",
    particleCount: clamp(Math.round(spec.particleCount), 40, 6_000),
    spawnMode: "instant",
    spawnDelaySeconds: 0,
    spawnDurationSeconds: 0,
    distribution: {
      type: "shell",
      radius: 1,
      thickness: 0.22,
      verticalBias: 0.05,
      horizontalBias: 0,
      noiseAmount: 0.08,
      symmetry: 0,
    },
    velocity: {
      speedMin: spec.spread * 7,
      speedMax: spec.spread * 13,
      radialSpeed: 1,
      tangentialSpeed: 0.15,
      upwardBias: 0.08,
      downwardBias: spec.gravity < -1.8 ? 0.2 : 0.06,
      inheritedLaunchVelocity: 0.03,
      turbulence: 0.08,
      curl: 0.03,
      drag: clamp(spec.drag, 0.05, 0.99),
      gravity: spec.gravity * 5.6,
      windScale: 0.15,
    },
    lifetime: {
      min: Math.max(0.35, spec.burstDuration * 0.68),
      max: Math.max(0.5, spec.burstDuration),
      fadeIn: 0.02,
      fadeOut: Math.max(0.25, spec.burstDuration * 0.38),
      random: 0.22,
    },
    appearance: {
      texture: "spark_core",
      sizeStart: clamp(spec.sparkSize * 120, 3, 20),
      sizeEnd: clamp(spec.sparkSize * 16, 0.2, 4),
      sizeRandomness: 0.3,
      sizeAttenuation: true,
      colorGradient: gradientFromColors(palette),
      emissiveIntensity: 2.8,
      alphaCurve: trailLength > 0.8 ? "glitter_decay" : "spark_flicker",
      temperatureShift: 0,
      twinkleFrequency: 10,
      twinkleAmount: 0.16,
      strobeFrequency: 0,
      strobeDutyCycle: 0.5,
      sparkleNoise: trailLength > 0.5 ? 0.26 : 0.1,
    },
    trail: {
      enabled: trailLength > 0,
      type: trailLength > 0.85 ? "spark_spawn" : "afterimage",
      lengthSeconds: trailLength,
      segmentCount: Math.round(clamp(trailLength * 8, 0, 18)),
      widthStart: clamp(spec.sparkSize * 52, 1, 7),
      widthEnd: 0,
      alphaDecay: 0.78,
      colorInheritsParticle: true,
      glitter: trailLength > 0.75 ? 0.32 : 0.12,
      fragmentation: trailLength > 0.9 ? 0.18 : 0.04,
    },
    events: {
      crossetteSplit: false,
      crackleBursts: 0,
      secondaryBurstProbability: 0,
      splitCount: 0,
      childParticleCount: 0,
    },
    blending: {
      mode: "additive",
      depthWrite: false,
      depthTest: true,
      renderOrder: 20,
    },
    lod: {
      minQuality: "low",
      maxDistance: 10_000,
      particleBudgetWeight: 1,
    },
  };
}

function legacySecondaryBreaks(spec: FireworkRenderSpec): BreakSpec[] {
  const count = clamp(Math.round(spec.secondaryBursts ?? 0), 0, 6);
  if (count === 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const layer = legacyPrimaryLayer({
      ...spec,
      particleCount: Math.max(50, Math.round(spec.particleCount * 0.22)),
      burstDuration: spec.burstDuration * 0.62,
      spread: spec.spread * 0.72,
      sparkSize: spec.sparkSize * 0.82,
      trailLength: spec.trailLength * 0.55,
      secondaryBursts: 0,
    });
    layer.id = `legacy-secondary-${index + 1}`;
    layer.role = "secondary_stars";
    return {
      enabled: true,
      timeOffsetSeconds: 0.16 + index * 0.16,
      burstType: "peony",
      shape: "sphere",
      layers: [layer],
      flash: {
        enabled: false,
        color: spec.colors[index % spec.colors.length] ?? "#FFFFFF",
        intensity: 1.4,
        size: 7,
        duration: 0.04,
        bloomMultiplier: 1,
      },
      smoke: {
        enabled: false,
        amount: 0,
        particleCount: 0,
        color: "#6B665D",
        opacity: 0,
        size: 8,
        riseSpeed: 0.6,
        expansion: 1,
        windScale: 0,
        turbulence: 0,
        lifetime: 2,
        fadeIn: 0.2,
        fadeOut: 1,
        texture: "smoke_puff",
        depthSoftening: 0.5,
      },
      subBreaks: [],
      scale: 1,
    };
  });
}

export function legacyFireworkRenderSpecToEffectSpecV2(
  input: FireworkRenderSpec,
  options: {
    id?: string;
    name?: string;
    description?: string | null;
    slug?: string;
    seed?: number;
    source?: FireworkEffectSpecV2["source"];
    overrides?: FireworkRenderParams | null;
  } = {},
): FireworkEffectSpecV2 {
  const spec = mergeLegacySpec(input, options.overrides);
  const palette = spec.colors.length > 0 ? spec.colors : DEFAULT_LEGACY_COLORS;
  const heightMeters = clamp(spec.launchHeight * 28, 20, 180);
  const liftTimeSeconds = 1.15;
  const primaryLayer = legacyPrimaryLayer(spec);
  const breakSpec: BreakSpec = {
    enabled: true,
    timeOffsetSeconds: liftTimeSeconds,
    burstType: options.slug === "willow" ? "willow" : "peony",
    shape: options.slug === "willow" ? "willow_droop" : "sphere",
    layers: [primaryLayer],
    flash: {
      enabled: true,
      color: palette[0] ?? "#FFFFFF",
      intensity: 2.8,
      size: clamp(spec.sparkSize * 150, 6, 18),
      duration: 0.08,
      bloomMultiplier: 1.8,
    },
    smoke: {
      enabled: true,
      amount: 0.18,
      particleCount: 18,
      color: "#6B665D",
      opacity: 0.14,
      size: 10,
      riseSpeed: 0.55,
      expansion: 1.2,
      windScale: 0.6,
      turbulence: 0.35,
      lifetime: 4,
      fadeIn: 0.35,
      fadeOut: 2,
      texture: "smoke_puff",
      depthSoftening: 0.5,
    },
    subBreaks: legacySecondaryBreaks(spec),
    reports: [],
    randomness: { migratedFromLegacy: true },
    rotation: { pan: 0, tilt: 90, roll: 0 },
    scale: 1,
    colorPhases: [],
  };

  return FireworkEffectSpecV2Schema.parse({
    id: options.id,
    version: 2,
    name: options.name ?? "Legacy firework",
    description: options.description ?? "Migrated from FireworkRenderSpec.",
    source: options.source ?? "legacy_migrated",
    confidence: 0.85,
    seed: options.seed ?? 1,
    type: options.slug === "comet" ? "comet" : "shell",
    globalScale: 0.045,
    durationSeconds: liftTimeSeconds + spec.burstDuration + 0.6,
    prefireSeconds: 0,
    heightMeters,
    colorPalette: palette,
    renderProfile: {
      quality: "high",
      maxParticles: 80_000,
      maxTrailSegments: 160_000,
      useGPUShaders: true,
      useBloom: true,
      useHDR: true,
      useSmoke: true,
      usePostFX: true,
      pixelRatioLimit: 1.75,
      lodDistanceScale: 1,
      deterministic: true,
      debugMode: false,
    },
    launch: {
      enabled: true,
      liftTimeSeconds,
      startPosition: { x: 0, y: 0, z: 0 },
      endHeightMeters: heightMeters,
      launchVelocity: heightMeters / liftTimeSeconds,
      arcAmount: 0.03,
      gravity: -9.8,
      drag: 0.96,
      tracerColor: palette[0] ?? "#FFD36A",
      tracerSize: clamp(spec.sparkSize * 70, 2.5, 7),
      tracerLifetime: 0.55,
      tracerTrailLength: Math.max(0.25, spec.trailLength * 0.45),
      tracerSparkRate: 26,
      tracerSparkSize: clamp(spec.sparkSize * 40, 1.5, 5),
      tracerSmokeAmount: 0.14,
      liftFlashSize: 7,
      liftFlashColor: "#FFE8A3",
      randomWobble: 0.035,
      windInfluence: 0.16,
    },
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
      symmetryJitter: 0,
      manufacturingVariation: 0,
      shots: [
        {
          index: 0,
          timeOffsetSeconds: 0,
          launchPositionOffset: { x: 0, y: 0, z: 0 },
          panDegrees: 0,
          tiltDegrees: 90,
          rollDegrees: 0,
          launchHeightMeters: heightMeters,
          liftTimeSeconds,
          breakSpec,
          seedOffset: 0,
          confidence: 0.85,
        },
      ],
    },
    effectLayers: [primaryLayer],
    audio: {
      events: [
        { timeSeconds: 0, kind: "launch", confidence: 0.8 },
        { timeSeconds: liftTimeSeconds, kind: "burst", confidence: 0.8 },
      ],
      gain: 1,
    },
    cameraHints: {
      targetHeightMeters: heightMeters * 0.58,
      suggestedDistanceMeters: heightMeters * 1.35,
    },
    metadata: {
      migratedFrom: "FireworkRenderSpec",
      legacyFieldsUsed: [
        "particleCount",
        "burstDuration",
        "colors",
        "spread",
        "launchHeight",
        "gravity",
        "drag",
        "sparkSize",
        "trailLength",
        "secondaryBursts",
      ],
    },
  });
}

export function applyLegacyOverridesToEffectSpecV2(
  spec: FireworkEffectSpecV2,
  overrides?: FireworkRenderParams | null,
): FireworkEffectSpecV2 {
  if (!overrides) return spec;
  const copy = structuredClone(spec) as FireworkEffectSpecV2;
  const firstShot = copy.shotSequence.shots[0];
  const breakSpec = firstShot?.breakSpec;
  const primary = breakSpec?.layers[0] ?? copy.effectLayers[0];
  if (overrides.colors && overrides.colors.length > 0) {
    copy.colorPalette = overrides.colors;
    if (primary) primary.appearance.colorGradient = gradientFromColors(overrides.colors);
  }
  if (typeof overrides.particleCount === "number" && primary) {
    primary.particleCount = Math.round(overrides.particleCount);
  }
  if (typeof overrides.burstDuration === "number" && primary) {
    primary.lifetime.max = overrides.burstDuration;
    primary.lifetime.min = Math.max(0.35, overrides.burstDuration * 0.68);
    copy.durationSeconds = Math.max(copy.durationSeconds, overrides.burstDuration + 1.4);
  }
  if (typeof overrides.spread === "number" && primary) {
    primary.velocity.speedMin = overrides.spread * 7;
    primary.velocity.speedMax = overrides.spread * 13;
  }
  if (typeof overrides.launchHeight === "number") {
    copy.heightMeters = clamp(overrides.launchHeight * 28, 20, 180);
    copy.launch.endHeightMeters = copy.heightMeters;
    if (firstShot) firstShot.launchHeightMeters = copy.heightMeters;
  }
  if (typeof overrides.gravity === "number" && primary) {
    primary.velocity.gravity = overrides.gravity * 5.6;
  }
  if (typeof overrides.drag === "number" && primary) {
    primary.velocity.drag = clamp(overrides.drag, 0.05, 0.99);
  }
  if (typeof overrides.sparkSize === "number" && primary) {
    primary.appearance.sizeStart = clamp(overrides.sparkSize * 120, 3, 20);
    primary.appearance.sizeEnd = clamp(overrides.sparkSize * 16, 0.2, 4);
  }
  if (typeof overrides.trailLength === "number" && primary) {
    primary.trail.enabled = overrides.trailLength > 0;
    primary.trail.lengthSeconds = overrides.trailLength;
    primary.trail.segmentCount = Math.round(clamp(overrides.trailLength * 8, 0, 18));
  }
  return FireworkEffectSpecV2Schema.parse(copy);
}

export function effectSpecV2ToLegacyRenderSpec(
  spec: FireworkEffectSpecV2,
): FireworkRenderSpec {
  const firstShot = spec.shotSequence.shots[0];
  const firstLayer = firstShot?.breakSpec?.layers[0] ?? spec.effectLayers[0];
  const duration =
    firstLayer?.lifetime.max ??
    Math.max(0.25, spec.durationSeconds - (firstShot?.liftTimeSeconds ?? 1.15));
  const speed = firstLayer
    ? (firstLayer.velocity.speedMin + firstLayer.velocity.speedMax) / 20
    : 2.6;
  const colors =
    firstLayer?.appearance.colorGradient
      .map((stop) => stop.color)
      .filter((color, index, all) => all.indexOf(color) === index) ??
    spec.colorPalette;

  return {
    particleCount: firstLayer?.particleCount ?? 220,
    burstDuration: duration,
    colors: colors.length > 0 ? colors : DEFAULT_LEGACY_COLORS,
    spread: speed,
    launchHeight: spec.heightMeters / 28,
    gravity: (firstLayer?.velocity.gravity ?? -9.8) / 5.6,
    drag: firstLayer?.velocity.drag ?? 0.86,
    sparkSize: (firstLayer?.appearance.sizeStart ?? 9) / 120,
    trailLength: firstLayer?.trail.lengthSeconds ?? 0,
    secondaryBursts: firstShot?.breakSpec?.subBreaks?.length || undefined,
    sections: [
      {
        id: "v2-main-break",
        label: spec.name,
        phase: "burst",
        startTimeSeconds: 0,
        endTimeSeconds: spec.durationSeconds,
        burstTimeSeconds:
          firstShot?.breakSpec?.timeOffsetSeconds ??
          firstShot?.liftTimeSeconds ??
          1.15,
        colors: colors.length > 0 ? colors : DEFAULT_LEGACY_COLORS,
        particleCount: firstLayer?.particleCount ?? 220,
        spread: speed,
        launchHeight: spec.heightMeters / 28,
        burstDuration: duration,
        gravity: (firstLayer?.velocity.gravity ?? -9.8) / 5.6,
        drag: firstLayer?.velocity.drag ?? 0.86,
        sparkSize: (firstLayer?.appearance.sizeStart ?? 9) / 120,
        trailLength: firstLayer?.trail.lengthSeconds ?? 0,
        secondaryBursts: firstShot?.breakSpec?.subBreaks?.length || undefined,
        confidence: spec.confidence,
      },
    ],
    audioSync: spec.audio.events
      .filter((event) => ["launch", "burst", "crackle", "fade"].includes(event.kind))
      .map((event) => ({
        timeSeconds: event.timeSeconds,
        kind: event.kind as "launch" | "burst" | "crackle" | "fade",
        confidence: event.confidence,
      })),
  };
}
