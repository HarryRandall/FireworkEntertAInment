"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ReplayCue } from "@/lib/shows";
import {
  FireworksEngine,
  type FireworksEngineStats,
} from "@/lib/fireworks/FireworksEngine";
import { createSeededRng } from "@/lib/fireworks/random";

if (typeof window !== "undefined") {
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Clock: This module has been deprecated")
    ) {
      return;
    }
    origWarn(...args);
  };
}

type ReplaySceneProps = {
  cues: ReplayCue[];
  elapsed: number;
  interactive: boolean;
  debug: boolean;
};

function Starfield() {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const rng = createSeededRng(20260214);
    const count = 1_100;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = rng.signed(18);
      positions[i * 3 + 1] = rng.range(-0.4, 11.5);
      positions[i * 3 + 2] = -rng.range(2, 20);
      const warmth = rng.range(0.72, 1);
      colors[i * 3 + 0] = warmth;
      colors[i * 3 + 1] = warmth * rng.range(0.85, 1);
      colors[i * 3 + 2] = 1;
    }
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geom;
  }, []);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <points geometry={geometry} renderOrder={1}>
      <pointsMaterial
        size={0.026}
        vertexColors
        transparent
        opacity={0.58}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function GroundGrid() {
  return (
    <group position={[0, -1.45, -1]}>
      <gridHelper args={[18, 18, "#40516F", "#22304A"]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]}>
        <planeGeometry args={[18, 18, 1, 1]} />
        <meshBasicMaterial color="#05070D" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function EngineBridge({ cues, elapsed, debug }: ReplaySceneProps) {
  const { scene, gl } = useThree();
  const engineRef = useRef<FireworksEngine | null>(null);
  const latestStatsAt = useRef(0);
  const [stats, setStats] = useState<FireworksEngineStats | null>(null);

  useEffect(() => {
    const engine = new FireworksEngine(scene, {
      pixelRatio: gl.getPixelRatio(),
      debug,
    });
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, [debug, gl, scene]);

  useEffect(() => {
    engineRef.current?.setCues(cues);
  }, [cues]);

  useFrame(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setPixelRatio(gl.getPixelRatio());
    engine.setElapsed(elapsed);
    if (debug && elapsed - latestStatsAt.current > 0.3) {
      latestStatsAt.current = elapsed;
      setStats(engine.getStats());
    }
  });

  if (!debug || !stats) return null;
  return (
    <Html position={[-3.7, 3.7, 0]} transform={false} zIndexRange={[20, 0]}>
      <div className="w-56 rounded-xl border border-white/10 bg-black/55 p-3 font-mono text-[10px] leading-relaxed text-white shadow-2xl backdrop-blur">
        <div>cues: {stats.cues}</div>
        <div>events: {stats.scheduledEvents}</div>
        <div>particles: {stats.particles}</div>
        <div>trails: {stats.trailParticles}</div>
        <div>smoke: {stats.smokeParticles}</div>
      </div>
    </Html>
  );
}

function ReplayScene({
  cues,
  elapsed,
  interactive,
  debug,
}: ReplaySceneProps) {
  return (
    <>
      <color attach="background" args={["#05070D"]} />
      <ambientLight intensity={0.36} />
      <fog attach="fog" args={["#05070D", 7, 24]} />
      <Starfield />
      <GroundGrid />
      <EngineBridge
        cues={cues}
        elapsed={elapsed}
        interactive={interactive}
        debug={debug}
      />
      {interactive ? (
        <OrbitControls
          target={[0, 0.9, -0.9]}
          enableDamping
          dampingFactor={0.08}
          minDistance={2.4}
          maxDistance={12}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2 - 0.04}
        />
      ) : null}
    </>
  );
}

export function FireworkReplayCanvas({
  cues,
  elapsed,
  interactive = true,
  debug = false,
}: {
  cues: ReplayCue[];
  elapsed: number;
  interactive?: boolean;
  debug?: boolean;
}) {
  const maxDpr = useMemo(() => {
    if (typeof window === "undefined") return 2;
    return Math.min(3, Math.max(2, window.devicePixelRatio || 2));
  }, []);

  return (
    <Canvas
      className="h-full w-full min-h-0 touch-none bg-transparent"
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        precision: "highp",
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.04;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      camera={{ position: [0, 1.45, 7.4], fov: 58 }}
      dpr={[1.5, maxDpr]}
    >
      <ReplayScene
        cues={cues}
        elapsed={elapsed}
        interactive={interactive}
        debug={debug}
      />
    </Canvas>
  );
}
