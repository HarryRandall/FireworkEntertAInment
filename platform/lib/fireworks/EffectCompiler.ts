import * as THREE from "three";
import type { FireworkRenderSpec, ReplayCue } from "@/lib/shows";
import {
  applyLegacyOverridesToEffectSpecV2,
  legacyFireworkRenderSpecToEffectSpecV2,
} from "@/lib/fireworks/legacy-adapter";
import {
  FireworkEffectSpecV2Schema,
  type BreakSpec,
  type FireworkEffectSpecV2,
  type FlashSpec,
  type LaunchSpec,
  type ParticleLayerSpec,
  type ShotSpec,
  type SmokeSpec,
} from "@/lib/fireworks/spec-v2";
import {
  FireworkEffectSpecV3Schema,
  fireworkEffectSpecV3ToV2,
} from "@/lib/fireworks/spec-v3";
import { createSeededRng, mixSeed, type SeededRng } from "@/lib/fireworks/random";
import type { ParticleWrite } from "@/lib/fireworks/ParticlePool";

export type EngineEmitTargets = {
  particles: { write: (particle: ParticleWrite) => void };
  trails: { write: (particle: ParticleWrite) => void };
  smoke: { write: (particle: ParticleWrite) => void };
};

export type CompiledEffectEvent =
  | {
      kind: "launch";
      id: string;
      cueId: string;
      time: number;
      expiresAt: number;
      seed: number;
      origin: THREE.Vector3;
      end: THREE.Vector3;
      launch: LaunchSpec;
      scale: number;
      liftTimeSeconds: number;
    }
  | {
      kind: "layer";
      id: string;
      cueId: string;
      time: number;
      expiresAt: number;
      seed: number;
      origin: THREE.Vector3;
      launchVelocity: THREE.Vector3;
      layer: ParticleLayerSpec;
      breakSpec: BreakSpec;
      scale: number;
      qualityScale: number;
    }
  | {
      kind: "flash";
      id: string;
      cueId: string;
      time: number;
      expiresAt: number;
      seed: number;
      origin: THREE.Vector3;
      flash: FlashSpec;
      scale: number;
    }
  | {
      kind: "smoke";
      id: string;
      cueId: string;
      time: number;
      expiresAt: number;
      seed: number;
      origin: THREE.Vector3;
      smoke: SmokeSpec;
      scale: number;
    };

const GROUND_Y = -1.45;
const COLOR_CACHE = new Map<string, [number, number, number]>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function colorToRgb(color: string): [number, number, number] {
  const cached = COLOR_CACHE.get(color);
  if (cached) return cached;
  const parsed = new THREE.Color(color);
  const rgb: [number, number, number] = [parsed.r, parsed.g, parsed.b];
  COLOR_CACHE.set(color, rgb);
  return rgb;
}

function alphaCurveCode(curve: ParticleLayerSpec["appearance"]["alphaCurve"]): number {
  switch (curve) {
    case "linear":
      return 0;
    case "ease_out":
      return 1;
    case "spark_flicker":
      return 2;
    case "strobe":
      return 3;
    case "glitter_decay":
      return 4;
    case "custom":
      return 5;
  }
}

function gradientTriplet(
  gradient: ParticleLayerSpec["appearance"]["colorGradient"],
): {
  start: [number, number, number];
  mid: [number, number, number];
  end: [number, number, number];
  alphaStart: number;
  alphaMid: number;
  alphaEnd: number;
} {
  const sorted = [...gradient].sort((a, b) => a.t - b.t);
  const first = sorted[0] ?? { color: "#FFFFFF", alpha: 1 };
  const middle = sorted[Math.floor(sorted.length / 2)] ?? first;
  const last = sorted[sorted.length - 1] ?? first;
  return {
    start: colorToRgb(first.color),
    mid: colorToRgb(middle.color),
    end: colorToRgb(last.color),
    alphaStart: first.alpha,
    alphaMid: middle.alpha,
    alphaEnd: last.alpha,
  };
}

function launchDirection(panDegrees: number, tiltDegrees: number): THREE.Vector3 {
  const pan = THREE.MathUtils.degToRad(panDegrees);
  const tilt = THREE.MathUtils.degToRad(tiltDegrees);
  const horizontal = Math.cos(tilt);
  return new THREE.Vector3(
    Math.sin(pan) * horizontal,
    Math.sin(tilt),
    -Math.cos(pan) * horizontal,
  ).normalize();
}

function shotBasePosition(cue: ReplayCue, shot: ShotSpec, scale: number): THREE.Vector3 {
  const cueOffset = (mixSeed(cue.id, "position") % 1000) / 1000 - 0.5;
  return new THREE.Vector3(
    cueOffset * 0.5 + shot.launchPositionOffset.x * scale,
    GROUND_Y + shot.launchPositionOffset.y * scale,
    -0.6 + shot.launchPositionOffset.z * scale,
  );
}

function qualityScaleFor(spec: FireworkEffectSpecV2): number {
  switch (spec.renderProfile.quality) {
    case "low":
      return 0.35;
    case "medium":
      return 0.62;
    case "high":
      return 1;
    case "ultra":
      return 1.35;
  }
}

function eventLifetimeForLayer(layer: ParticleLayerSpec): number {
  return (
    layer.spawnDelaySeconds +
    layer.spawnDurationSeconds +
    layer.lifetime.max +
    (layer.trail.enabled ? layer.trail.lengthSeconds : 0) +
    0.35
  );
}

export function resolveCueEffectSpec(cue: ReplayCue): FireworkEffectSpecV2 {
  const maybeV3 = FireworkEffectSpecV3Schema.safeParse(cue.firework.spec);
  if (maybeV3.success) {
    return fireworkEffectSpecV3ToV2(maybeV3.data);
  }
  const maybeV2 = FireworkEffectSpecV2Schema.safeParse(cue.firework.spec);
  if (maybeV2.success) {
    return applyLegacyOverridesToEffectSpecV2(maybeV2.data, cue.renderParams);
  }
  return legacyFireworkRenderSpecToEffectSpecV2(cue.firework.spec as FireworkRenderSpec, {
    id: cue.firework.id,
    name: cue.firework.name,
    description: cue.firework.description,
    slug: cue.firework.slug,
    seed: mixSeed(cue.firework.id, cue.firework.slug),
    overrides: cue.renderParams,
  });
}

function compileBreakEvents(
  events: CompiledEffectEvent[],
  params: {
    cue: ReplayCue;
    spec: FireworkEffectSpecV2;
    breakSpec: BreakSpec;
    time: number;
    origin: THREE.Vector3;
    launchVelocity: THREE.Vector3;
    parentSeed: number;
    scale: number;
    qualityScale: number;
    path: string;
  },
): void {
  if (!params.breakSpec.enabled) return;
  params.breakSpec.layers.forEach((layer, layerIndex) => {
    if (!layer.enabled || layer.particleCount <= 0) return;
    const layerTime = params.time + layer.spawnDelaySeconds;
    events.push({
      kind: "layer",
      id: `${params.path}:layer:${layer.id}:${layerIndex}`,
      cueId: params.cue.id,
      time: layerTime,
      expiresAt: layerTime + eventLifetimeForLayer(layer),
      seed: mixSeed(params.parentSeed, layer.id, layerIndex),
      origin: params.origin.clone(),
      launchVelocity: params.launchVelocity.clone(),
      layer,
      breakSpec: params.breakSpec,
      scale: params.scale,
      qualityScale: params.qualityScale,
    });
  });

  if (params.breakSpec.flash?.enabled) {
    events.push({
      kind: "flash",
      id: `${params.path}:flash`,
      cueId: params.cue.id,
      time: params.time,
      expiresAt: params.time + params.breakSpec.flash.duration + 0.05,
      seed: mixSeed(params.parentSeed, "flash"),
      origin: params.origin.clone(),
      flash: params.breakSpec.flash,
      scale: params.scale,
    });
  }

  if (params.breakSpec.smoke?.enabled && params.spec.renderProfile.useSmoke) {
    events.push({
      kind: "smoke",
      id: `${params.path}:smoke`,
      cueId: params.cue.id,
      time: params.time + 0.03,
      expiresAt: params.time + params.breakSpec.smoke.lifetime + 0.1,
      seed: mixSeed(params.parentSeed, "smoke"),
      origin: params.origin.clone(),
      smoke: params.breakSpec.smoke,
      scale: params.scale,
    });
  }

  params.breakSpec.subBreaks?.forEach((subBreak, index) => {
    const rng = createSeededRng(mixSeed(params.parentSeed, "sub", index));
    const offset = randomDirection(rng, { type: "sphere" }).multiplyScalar(
      params.scale * rng.range(5, 14),
    );
    compileBreakEvents(events, {
      ...params,
      breakSpec: subBreak,
      time: params.time + subBreak.timeOffsetSeconds,
      origin: params.origin.clone().add(offset),
      parentSeed: mixSeed(params.parentSeed, "sub-break", index),
      path: `${params.path}:sub:${index}`,
    });
  });
}

export function compileCueEvents(cue: ReplayCue): CompiledEffectEvent[] {
  const spec = resolveCueEffectSpec(cue);
  const scale = spec.globalScale;
  const qualityScale = qualityScaleFor(spec);
  const events: CompiledEffectEvent[] = [];
  const cueSeed = mixSeed(spec.seed, cue.id, cue.timeSeconds);

  spec.shotSequence.shots.forEach((shot) => {
    const shotSeed = mixSeed(cueSeed, shot.index, shot.seedOffset);
    const launch = shot.tracer ?? spec.launch;
    const liftTimeSeconds =
      shot.liftTimeSeconds ?? launch.liftTimeSeconds ?? spec.launch.liftTimeSeconds;
    const heightMeters = shot.launchHeightMeters ?? spec.heightMeters;
    const start = shotBasePosition(cue, shot, scale);
    const direction = launchDirection(shot.panDegrees, shot.tiltDegrees);
    const end = start
      .clone()
      .add(direction.clone().multiplyScalar(heightMeters * scale));
    end.y = Math.max(end.y, GROUND_Y + heightMeters * scale * 0.72);
    const launchStart = cue.timeSeconds + shot.timeOffsetSeconds;
    const launchVelocity = end.clone().sub(start).multiplyScalar(1 / liftTimeSeconds);

    if (launch.enabled) {
      events.push({
        kind: "launch",
        id: `${cue.id}:shot:${shot.index}:launch`,
        cueId: cue.id,
        time: launchStart,
        expiresAt: launchStart + liftTimeSeconds + launch.tracerLifetime + 0.2,
        seed: mixSeed(shotSeed, "launch"),
        origin: start.clone(),
        end,
        launch,
        scale,
        liftTimeSeconds,
      });
    }

    if (shot.mineAtLaunch) {
      compileBreakEvents(events, {
        cue,
        spec,
        breakSpec: shot.mineAtLaunch,
        time: launchStart + shot.mineAtLaunch.timeOffsetSeconds,
        origin: start.clone(),
        launchVelocity,
        parentSeed: mixSeed(shotSeed, "mine"),
        scale,
        qualityScale,
        path: `${cue.id}:shot:${shot.index}:mine`,
      });
    }

    if (shot.breakSpec) {
      compileBreakEvents(events, {
        cue,
        spec,
        breakSpec: shot.breakSpec,
        time: launchStart + shot.breakSpec.timeOffsetSeconds,
        origin: end,
        launchVelocity,
        parentSeed: mixSeed(shotSeed, "break"),
        scale,
        qualityScale,
        path: `${cue.id}:shot:${shot.index}:break`,
      });
    }
  });

  return events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

function randomDirection(
  rng: SeededRng,
  distribution: Pick<
    ParticleLayerSpec["distribution"],
    "type"
  > &
    Partial<
      Pick<
        ParticleLayerSpec["distribution"],
        | "verticalBias"
        | "horizontalBias"
        | "angleStart"
        | "angleEnd"
        | "polarMin"
        | "polarMax"
        | "noiseAmount"
        | "symmetry"
        | "customPoints"
      >
    >,
  index = 0,
): THREE.Vector3 {
  if (distribution.type === "custom" && distribution.customPoints?.length) {
    const point = distribution.customPoints[index % distribution.customPoints.length];
    return new THREE.Vector3(point.x, point.y, point.z).normalize();
  }

  if (distribution.type === "ring" || distribution.type === "disc") {
    const start = THREE.MathUtils.degToRad(distribution.angleStart ?? 0);
    const end = THREE.MathUtils.degToRad(distribution.angleEnd ?? 360);
    const angle = start + (end - start) * rng.next();
    return new THREE.Vector3(Math.cos(angle), rng.signed(0.04), Math.sin(angle)).normalize();
  }

  if (distribution.type === "fan" || distribution.type === "cone") {
    const start = THREE.MathUtils.degToRad(distribution.angleStart ?? -35);
    const end = THREE.MathUtils.degToRad(distribution.angleEnd ?? 35);
    const angle = start + (end - start) * rng.next();
    const y = distribution.type === "cone" ? rng.range(0.15, 0.95) : rng.range(0.25, 0.85);
    return new THREE.Vector3(Math.sin(angle), y, -Math.cos(angle) * 0.35).normalize();
  }

  const symmetryCount = distribution.symmetry ?? 0;
  const symmetry = symmetryCount > 1;
  const theta = symmetry
    ? ((index % symmetryCount) / symmetryCount) * Math.PI * 2 +
      rng.signed(0.04)
    : rng.range(0, Math.PI * 2);
  const polarMin = THREE.MathUtils.degToRad(distribution.polarMin ?? 0);
  const polarMax = THREE.MathUtils.degToRad(distribution.polarMax ?? 180);
  const u = rng.next();
  const phi = polarMin + (polarMax - polarMin) * u;
  const sinPhi = Math.sin(phi);
  const dir = new THREE.Vector3(
    sinPhi * Math.cos(theta) + (distribution.horizontalBias ?? 0),
    Math.cos(phi) + (distribution.verticalBias ?? 0),
    sinPhi * Math.sin(theta),
  );
  if (distribution.noiseAmount) {
    dir.x += rng.signed(distribution.noiseAmount);
    dir.y += rng.signed(distribution.noiseAmount);
    dir.z += rng.signed(distribution.noiseAmount);
  }
  return dir.normalize();
}

function writeParticle(
  target: { write: (particle: ParticleWrite) => void },
  params: {
    origin: THREE.Vector3;
    velocity: THREE.Vector3;
    acceleration: THREE.Vector3;
    spawnTime: number;
    lifetime: number;
    sizeStart: number;
    sizeEnd: number;
    colors: ReturnType<typeof gradientTriplet>;
    drag: number;
    twinkleFrequency: number;
    twinkleAmount: number;
    strobeFrequency: number;
    strobeDutyCycle: number;
    emissiveIntensity: number;
    alphaCurve: number;
    seed: number;
    alphaScale?: number;
  },
): void {
  const alphaScale = params.alphaScale ?? 1;
  target.write({
    origin: [params.origin.x, params.origin.y, params.origin.z],
    velocity: [params.velocity.x, params.velocity.y, params.velocity.z],
    acceleration: [
      params.acceleration.x,
      params.acceleration.y,
      params.acceleration.z,
    ],
    spawnTime: params.spawnTime,
    lifetime: params.lifetime,
    sizeStart: params.sizeStart,
    sizeEnd: params.sizeEnd,
    colorStart: params.colors.start,
    colorMid: params.colors.mid,
    colorEnd: params.colors.end,
    alphaStart: params.colors.alphaStart * alphaScale,
    alphaMid: params.colors.alphaMid * alphaScale,
    alphaEnd: params.colors.alphaEnd * alphaScale,
    drag: params.drag,
    twinkleFrequency: params.twinkleFrequency,
    twinkleAmount: params.twinkleAmount,
    strobeFrequency: params.strobeFrequency,
    strobeDutyCycle: params.strobeDutyCycle,
    emissiveIntensity: params.emissiveIntensity,
    alphaCurve: params.alphaCurve,
    seed: params.seed,
  });
}

function emitLayerEvent(event: Extract<CompiledEffectEvent, { kind: "layer" }>, targets: EngineEmitTargets): void {
  const rng = createSeededRng(event.seed);
  const layer = event.layer;
  const count = Math.round(layer.particleCount * event.qualityScale);
  const colors = gradientTriplet(layer.appearance.colorGradient);
  const acceleration = new THREE.Vector3(0, layer.velocity.gravity * event.scale, 0);
  const target = layer.blending.mode === "normal_transparent" ? targets.smoke : targets.particles;
  const spawnDuration =
    layer.spawnMode === "instant" ? 0 : layer.spawnDurationSeconds;

  for (let i = 0; i < count; i++) {
    const dir = randomDirection(rng, layer.distribution, i);
    const speed =
      rng.range(layer.velocity.speedMin, layer.velocity.speedMax) * event.scale;
    const velocity = dir.multiplyScalar(speed);
    velocity.y +=
      (layer.velocity.upwardBias - layer.velocity.downwardBias) * speed +
      event.launchVelocity.y * layer.velocity.inheritedLaunchVelocity;
    velocity.x += event.launchVelocity.x * layer.velocity.inheritedLaunchVelocity;
    velocity.z += event.launchVelocity.z * layer.velocity.inheritedLaunchVelocity;
    if (layer.velocity.tangentialSpeed) {
      velocity.x += rng.signed(layer.velocity.tangentialSpeed * event.scale);
      velocity.z += rng.signed(layer.velocity.tangentialSpeed * event.scale);
    }

    const lifetime = rng.range(layer.lifetime.min, layer.lifetime.max);
    const spawnTime = event.time + rng.next() * spawnDuration;
    const sizeRandom = 1 + rng.signed(layer.appearance.sizeRandomness);
    const particleSeed = rng.next();
    writeParticle(target, {
      origin: event.origin,
      velocity,
      acceleration,
      spawnTime,
      lifetime,
      sizeStart: layer.appearance.sizeStart * sizeRandom,
      sizeEnd: layer.appearance.sizeEnd * sizeRandom,
      colors,
      drag: layer.velocity.drag,
      twinkleFrequency: layer.appearance.twinkleFrequency,
      twinkleAmount: layer.appearance.twinkleAmount,
      strobeFrequency: layer.appearance.strobeFrequency,
      strobeDutyCycle: layer.appearance.strobeDutyCycle,
      emissiveIntensity: layer.appearance.emissiveIntensity,
      alphaCurve: alphaCurveCode(layer.appearance.alphaCurve),
      seed: particleSeed,
    });

    if (layer.trail.enabled && layer.trail.segmentCount > 0) {
      const segments = clamp(layer.trail.segmentCount, 1, 24);
      for (let s = 1; s <= segments; s++) {
        const progress = s / segments;
        writeParticle(targets.trails, {
          origin: event.origin,
          velocity,
          acceleration,
          spawnTime: spawnTime + progress * layer.trail.lengthSeconds,
          lifetime: Math.max(0.08, lifetime - progress * layer.trail.lengthSeconds),
          sizeStart: THREE.MathUtils.lerp(
            layer.trail.widthStart,
            layer.trail.widthEnd,
            progress,
          ),
          sizeEnd: layer.trail.widthEnd,
          colors,
          drag: layer.velocity.drag,
          twinkleFrequency:
            layer.trail.glitter > 0 ? 24 + layer.trail.glitter * 24 : 0,
          twinkleAmount: layer.trail.glitter * 0.45,
          strobeFrequency: 0,
          strobeDutyCycle: 0.5,
          emissiveIntensity: layer.appearance.emissiveIntensity * 0.62,
          alphaCurve: 4,
          seed: particleSeed + s * 0.017,
          alphaScale: Math.pow(layer.trail.alphaDecay, s),
        });
      }
    }

    if (layer.events.crackleBursts > 0 && i < layer.events.crackleBursts) {
      const crackleCount = Math.max(4, layer.events.childParticleCount || 8);
      const splitAt = event.time + (layer.events.splitTime ?? lifetime * 0.62);
      for (let c = 0; c < crackleCount; c++) {
        const crackleDir = randomDirection(rng, { type: "sphere" });
        writeParticle(targets.particles, {
          origin: event.origin,
          velocity: velocity
            .clone()
            .multiplyScalar(0.18)
            .add(crackleDir.multiplyScalar(rng.range(3, 8) * event.scale)),
          acceleration,
          spawnTime: splitAt + rng.range(0, 0.18),
          lifetime: rng.range(0.18, 0.45),
          sizeStart: layer.appearance.sizeStart * 0.46,
          sizeEnd: 0,
          colors,
          drag: 0.88,
          twinkleFrequency: 36,
          twinkleAmount: 0.7,
          strobeFrequency: 0,
          strobeDutyCycle: 0.5,
          emissiveIntensity: layer.appearance.emissiveIntensity * 1.5,
          alphaCurve: 2,
          seed: rng.next(),
        });
      }
    }
  }
}

function emitLaunchEvent(event: Extract<CompiledEffectEvent, { kind: "launch" }>, targets: EngineEmitTargets): void {
  const rng = createSeededRng(event.seed);
  const launch = event.launch;
  const sparks = Math.max(4, Math.round(launch.tracerSparkRate * event.liftTimeSeconds));
  const path = event.end.clone().sub(event.origin);
  const velocity = path.clone().multiplyScalar(1 / event.liftTimeSeconds);
  const colors = {
    start: colorToRgb("#FFFFFF"),
    mid: colorToRgb(launch.tracerColor),
    end: colorToRgb(launch.tracerColor),
    alphaStart: 1,
    alphaMid: 0.8,
    alphaEnd: 0,
  };
  const acceleration = new THREE.Vector3(0, launch.gravity * event.scale * 0.16, 0);

  for (let i = 0; i < sparks; i++) {
    const t = i / sparks;
    const spawnTime = event.time + t * event.liftTimeSeconds;
    const origin = event.origin.clone().add(path.clone().multiplyScalar(t));
    origin.x += rng.signed(launch.randomWobble);
    origin.z += rng.signed(launch.randomWobble);
    writeParticle(targets.particles, {
      origin,
      velocity: velocity
        .clone()
        .multiplyScalar(0.16)
        .add(new THREE.Vector3(rng.signed(0.18), rng.range(0.02, 0.22), rng.signed(0.18))),
      acceleration,
      spawnTime,
      lifetime: launch.tracerLifetime * rng.range(0.75, 1.25),
      sizeStart: launch.tracerSparkSize,
      sizeEnd: 0,
      colors,
      drag: launch.drag,
      twinkleFrequency: 24,
      twinkleAmount: 0.18,
      strobeFrequency: 0,
      strobeDutyCycle: 0.5,
      emissiveIntensity: 2.8,
      alphaCurve: 2,
      seed: rng.next(),
    });
  }

  if (launch.liftFlashSize > 0) {
    writeParticle(targets.particles, {
      origin: event.origin,
      velocity: new THREE.Vector3(0, 0, 0),
      acceleration: new THREE.Vector3(0, 0, 0),
      spawnTime: event.time,
      lifetime: 0.12,
      sizeStart: launch.liftFlashSize,
      sizeEnd: 0,
      colors: {
        start: colorToRgb("#FFFFFF"),
        mid: colorToRgb(launch.liftFlashColor),
        end: colorToRgb(launch.liftFlashColor),
        alphaStart: 1,
        alphaMid: 0.8,
        alphaEnd: 0,
      },
      drag: 1,
      twinkleFrequency: 0,
      twinkleAmount: 0,
      strobeFrequency: 0,
      strobeDutyCycle: 0.5,
      emissiveIntensity: 4,
      alphaCurve: 1,
      seed: rng.next(),
    });
  }
}

function emitFlashEvent(event: Extract<CompiledEffectEvent, { kind: "flash" }>, targets: EngineEmitTargets): void {
  const colors = {
    start: colorToRgb("#FFFFFF"),
    mid: colorToRgb(event.flash.color),
    end: colorToRgb(event.flash.color),
    alphaStart: 1,
    alphaMid: 0.75,
    alphaEnd: 0,
  };
  writeParticle(targets.particles, {
    origin: event.origin,
    velocity: new THREE.Vector3(0, 0, 0),
    acceleration: new THREE.Vector3(0, 0, 0),
    spawnTime: event.time,
    lifetime: event.flash.duration,
    sizeStart: event.flash.size * 0.55,
    sizeEnd: 0,
    colors,
    drag: 1,
    twinkleFrequency: 0,
    twinkleAmount: 0,
    strobeFrequency: 0,
    strobeDutyCycle: 0.5,
    emissiveIntensity: event.flash.intensity,
    alphaCurve: 1,
    seed: event.seed / 4294967296,
  });
}

function emitSmokeEvent(event: Extract<CompiledEffectEvent, { kind: "smoke" }>, targets: EngineEmitTargets): void {
  const rng = createSeededRng(event.seed);
  const smoke = event.smoke;
  const colors = {
    start: colorToRgb(smoke.color),
    mid: colorToRgb(smoke.color),
    end: colorToRgb("#1B1D22"),
    alphaStart: 0,
    alphaMid: smoke.opacity,
    alphaEnd: 0,
  };
  const count = Math.round(smoke.particleCount * clamp(smoke.amount, 0, 2));
  for (let i = 0; i < count; i++) {
    writeParticle(targets.smoke, {
      origin: event.origin
        .clone()
        .add(new THREE.Vector3(rng.signed(0.2), rng.signed(0.08), rng.signed(0.2))),
      velocity: new THREE.Vector3(
        rng.signed(smoke.turbulence),
        smoke.riseSpeed + rng.range(0, smoke.expansion),
        rng.signed(smoke.turbulence),
      ).multiplyScalar(event.scale),
      acceleration: new THREE.Vector3(0, 0.04 * event.scale, 0),
      spawnTime: event.time + rng.range(0, 0.6),
      lifetime: smoke.lifetime * rng.range(0.75, 1.25),
      sizeStart: smoke.size * rng.range(0.6, 1.25),
      sizeEnd: smoke.size * smoke.expansion,
      colors,
      drag: 0.98,
      twinkleFrequency: 0,
      twinkleAmount: 0,
      strobeFrequency: 0,
      strobeDutyCycle: 0.5,
      emissiveIntensity: 0.2,
      alphaCurve: 5,
      seed: rng.next(),
    });
  }
}

export function emitCompiledEvent(
  event: CompiledEffectEvent,
  targets: EngineEmitTargets,
): void {
  switch (event.kind) {
    case "launch":
      emitLaunchEvent(event, targets);
      return;
    case "layer":
      emitLayerEvent(event, targets);
      return;
    case "flash":
      emitFlashEvent(event, targets);
      return;
    case "smoke":
      emitSmokeEvent(event, targets);
      return;
  }
}

export function eventIsActiveAt(event: CompiledEffectEvent, elapsed: number): boolean {
  return event.time <= elapsed && event.expiresAt >= elapsed;
}
