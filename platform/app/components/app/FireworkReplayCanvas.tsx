"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FireworkRenderSpec, ReplayCue } from "@/lib/shows";

type Burst = {
  id: string;
  cueId: string;
  origin: THREE.Vector3;
  startTime: number;
  spec: FireworkRenderSpec;
  color: THREE.Color;
  directions: Float32Array;
  speeds: Float32Array;
  geometry: THREE.BufferGeometry;
  positionAttr: THREE.BufferAttribute;
};

const LAUNCH_DURATION_SECONDS = 1.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createSparkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.42, "rgba(255,255,255,0.82)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function mergeSpec(
  spec: FireworkRenderSpec,
  overrides: ReplayCue["renderParams"],
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

function makeBurst(cue: ReplayCue, index: number): Burst {
  const spec = mergeSpec(cue.firework.spec, cue.renderParams);
  const count = clamp(Math.round(spec.particleCount), 40, 700);
  const directions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const styleBias = cue.firework.slug === "willow" ? -0.35 : 0.16;

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    directions[i * 3 + 0] = Math.sin(phi) * Math.cos(theta);
    directions[i * 3 + 1] = Math.cos(phi) * 0.82 + styleBias;
    directions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta);
    speeds[i] = spec.spread * (0.48 + Math.random() * 0.58);
  }

  const livePositions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(livePositions, 3);
  geometry.setAttribute("position", positionAttr);

  const colors = spec.colors.length > 0 ? spec.colors : ["#00E5FF"];
  const xOffset =
    index === 0 ? 0 : (index - (spec.secondaryBursts ?? 0) / 2) * 1.2;

  return {
    id: `${cue.id}-${index}-${Math.random().toString(36).slice(2)}`,
    cueId: cue.id,
    origin: new THREE.Vector3(
      xOffset + (Math.random() - 0.5) * 0.65,
      spec.launchHeight * 0.5 + 0.85 + (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 1.1,
    ),
    startTime: cue.timeSeconds + index * 0.18,
    spec,
    color: new THREE.Color(colors[index % colors.length]),
    directions,
    speeds,
    geometry,
    positionAttr,
  };
}

function FireworkBurst({
  burst,
  elapsed,
  onExpire,
}: {
  burst: Burst;
  elapsed: number;
  onExpire: (id: string) => void;
}) {
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const cometRef = useRef<THREE.Mesh>(null);
  const cometMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const sparkTexture = useMemo(() => createSparkTexture(), []);

  useEffect(() => {
    return () => {
      burst.geometry.dispose();
      sparkTexture.dispose();
    };
  }, [burst.geometry, sparkTexture]);

  useFrame(() => {
    const launchAge = elapsed - burst.startTime;
    const explosionAge = launchAge - LAUNCH_DURATION_SECONDS;

    if (launchAge < 0) {
      if (materialRef.current) materialRef.current.opacity = 0;
      if (cometMaterialRef.current) cometMaterialRef.current.opacity = 0;
      return;
    }

    if (launchAge <= LAUNCH_DURATION_SECONDS) {
      const progress = clamp(launchAge / LAUNCH_DURATION_SECONDS, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      if (cometRef.current) {
        cometRef.current.position.set(
          burst.origin.x * eased,
          -1.45 + (burst.origin.y + 1.45) * eased,
          burst.origin.z * eased,
        );
        const pulse = 1 + Math.sin(launchAge * 28) * 0.12;
        cometRef.current.scale.setScalar(pulse);
      }
      if (cometMaterialRef.current) cometMaterialRef.current.opacity = 0.9;
      if (materialRef.current) materialRef.current.opacity = 0;
      return;
    }

    if (cometMaterialRef.current) cometMaterialRef.current.opacity = 0;

    if (explosionAge > burst.spec.burstDuration) {
      onExpire(burst.id);
      return;
    }

    const live = burst.positionAttr.array as Float32Array;
    const drag = Math.exp(
      -explosionAge * (1 - clamp(burst.spec.drag, 0.05, 0.98)),
    );
    for (let i = 0; i < burst.speeds.length; i++) {
      const dx = burst.directions[i * 3 + 0];
      const dy = burst.directions[i * 3 + 1];
      const dz = burst.directions[i * 3 + 2];
      const speed = burst.speeds[i];
      live[i * 3 + 0] = burst.origin.x + dx * speed * explosionAge * drag;
      live[i * 3 + 1] =
        burst.origin.y +
        dy * speed * explosionAge * drag +
        0.5 * burst.spec.gravity * 0.55 * explosionAge * explosionAge;
      live[i * 3 + 2] = burst.origin.z + dz * speed * explosionAge * drag;
    }
    burst.positionAttr.needsUpdate = true;

    if (materialRef.current) {
      const fade = Math.max(0, 1 - explosionAge / burst.spec.burstDuration);
      materialRef.current.opacity = Math.pow(fade, 1.15);
      materialRef.current.size =
        burst.spec.sparkSize *
        1.55 *
        (1 + Math.sin(explosionAge * 16) * 0.16);
    }
  });

  return (
    <>
      <mesh ref={cometRef} position={[0, -1.45, 0]}>
        <sphereGeometry args={[0.085, 24, 24]} />
        <meshBasicMaterial
          ref={cometMaterialRef}
          color={burst.color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <points geometry={burst.geometry}>
        <pointsMaterial
          ref={materialRef}
          color={burst.color}
          size={burst.spec.sparkSize * 1.85}
          map={sparkTexture}
          alphaTest={0.02}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </>
  );
}

function Starfield() {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 28;
      positions[i * 3 + 1] = Math.random() * 12 - 0.5;
      positions[i * 3 + 2] = -Math.random() * 16 - 2;
    }
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geom;
  }, []);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#F5F7FA"
        size={0.026}
        transparent
        opacity={0.48}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function GroundGrid() {
  return (
    <gridHelper
      args={[16, 16, "#31415F", "#22304A"]}
      position={[0, -1.45, -1]}
    />
  );
}

function ReplayScene({
  cues,
  elapsed,
  interactive = true,
}: {
  cues: ReplayCue[];
  elapsed: number;
  interactive?: boolean;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const firedCueIds = useRef(new Set<string>());
  const lastElapsed = useRef(elapsed);

  useEffect(() => {
    if (elapsed < lastElapsed.current) {
      firedCueIds.current.clear();
      setBursts([]);
    }
    lastElapsed.current = elapsed;
  }, [elapsed]);

  useFrame(() => {
    const ready = cues.filter(
      (cue) => cue.timeSeconds <= elapsed && !firedCueIds.current.has(cue.id),
    );
    if (ready.length === 0) return;

    setBursts((current) => {
      const next = [...current];
      for (const cue of ready) {
        firedCueIds.current.add(cue.id);
        const spec = mergeSpec(cue.firework.spec, cue.renderParams);
        const burstCount = 1 + clamp(spec.secondaryBursts ?? 0, 0, 4);
        for (let i = 0; i < burstCount; i++) next.push(makeBurst(cue, i));
      }
      return next.slice(-16);
    });
  });

  return (
    <>
      <ambientLight intensity={0.48} />
      <fog attach="fog" args={["#05070D", 8, 22]} />
      <Starfield />
      <GroundGrid />
      {interactive ? (
        <OrbitControls
          target={[0, 0.85, -0.8]}
          enableDamping
          dampingFactor={0.08}
          minDistance={2.5}
          maxDistance={11}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      ) : null}
      {bursts.map((burst) => (
        <FireworkBurst
          key={burst.id}
          burst={burst}
          elapsed={elapsed}
          onExpire={(id) =>
            setBursts((current) => current.filter((item) => item.id !== id))
          }
        />
      ))}
    </>
  );
}

export function FireworkReplayCanvas({
  cues,
  elapsed,
  interactive = true,
}: {
  cues: ReplayCue[];
  elapsed: number;
  interactive?: boolean;
}) {
  return (
    <Canvas
      className="h-full w-full min-h-0 touch-none bg-transparent"
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      camera={{ position: [0, 1.35, 7.2], fov: 58 }}
      dpr={[1, 1.75]}
    >
      <ReplayScene cues={cues} elapsed={elapsed} interactive={interactive} />
    </Canvas>
  );
}
