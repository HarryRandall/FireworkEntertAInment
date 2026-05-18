"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { staticShowCrafterPalette } from "@/app/components/ui/tokens";

const PALETTE = [
  new THREE.Color(staticShowCrafterPalette.primary),
  new THREE.Color(staticShowCrafterPalette.secondary),
  new THREE.Color(staticShowCrafterPalette.tertiary),
  new THREE.Color(staticShowCrafterPalette.magenta),
  new THREE.Color(staticShowCrafterPalette.highlight),
];

const PARTICLES_PER_BURST = 220;
const BURST_LIFETIME = 2.4;
const MAX_BURSTS = 6;
const GRAVITY = -1.6;

type Burst = {
  origin: THREE.Vector3;
  startTime: number;
  color: THREE.Color;
  positions: Float32Array; // base direction × speed (unit dir scaled)
  speeds: Float32Array;
  geom: THREE.BufferGeometry;
  posAttr: THREE.BufferAttribute;
};

function makeBurst(now: number): Burst {
  const positions = new Float32Array(PARTICLES_PER_BURST * 3);
  const speeds = new Float32Array(PARTICLES_PER_BURST);
  for (let i = 0; i < PARTICLES_PER_BURST; i++) {
    // Random direction on a sphere, slight upward bias
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const dx = Math.sin(phi) * Math.cos(theta);
    const dy = Math.cos(phi) * 0.8 + 0.2; // bias up
    const dz = Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 0] = dx;
    positions[i * 3 + 1] = dy;
    positions[i * 3 + 2] = dz;
    speeds[i] = 1.6 + Math.random() * 1.4;
  }
  const livePositions = new Float32Array(PARTICLES_PER_BURST * 3);
  const geom = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(livePositions, 3);
  geom.setAttribute("position", posAttr);
  return {
    origin: new THREE.Vector3(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.2) * 1.6 + 0.4,
      (Math.random() - 0.5) * 2 - 1,
    ),
    startTime: now,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)].clone(),
    positions,
    speeds,
    geom,
    posAttr,
  };
}

function FireworkBurst({ burst, onExpire }: { burst: Burst; onExpire: () => void }) {
  const matRef = useRef<THREE.PointsMaterial>(null);
  useFrame(() => {
    const t = performance.now() / 1000 - burst.startTime;
    if (t > BURST_LIFETIME) {
      onExpire();
      return;
    }
    const live = burst.posAttr.array as Float32Array;
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      const dx = burst.positions[i * 3 + 0];
      const dy = burst.positions[i * 3 + 1];
      const dz = burst.positions[i * 3 + 2];
      const sp = burst.speeds[i];
      const drag = Math.exp(-t * 0.9);
      live[i * 3 + 0] = burst.origin.x + dx * sp * t * drag;
      live[i * 3 + 1] =
        burst.origin.y + dy * sp * t * drag + 0.5 * GRAVITY * t * t;
      live[i * 3 + 2] = burst.origin.z + dz * sp * t * drag;
    }
    burst.posAttr.needsUpdate = true;
    if (matRef.current) {
      const fade = Math.max(0, 1 - t / BURST_LIFETIME);
      matRef.current.opacity = Math.pow(fade, 1.4);
      matRef.current.size = 0.08 + 0.03 * Math.sin(t * 14);
    }
  });

  return (
    <points geometry={burst.geom}>
      <pointsMaterial
        ref={matRef}
        color={burst.color}
        size={0.09}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function Starfield() {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const N = 800;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = -Math.random() * 14 - 4;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const matRef = useRef<THREE.PointsMaterial>(null);
  useFrame(() => {
    if (matRef.current) {
      matRef.current.opacity = 0.45 + 0.15 * Math.sin(performance.now() / 1000 * 0.6);
    }
  });
  return (
    <points geometry={geom}>
      <pointsMaterial
        ref={matRef}
        color={staticShowCrafterPalette.onSurface}
        size={0.025}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  );
}

function PointerCamera() {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });
  useEffect(() => {
    function onMove(e: PointerEvent) {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * 0.8;
      target.current.y = (e.clientY / window.innerHeight - 0.5) * 0.5;
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  useFrame(() => {
    camera.position.x += (target.current.x - camera.position.x) * 0.04;
    camera.position.y += (-target.current.y - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function BurstManager() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const lastSpawn = useRef(0);

  useFrame(() => {
    const now = performance.now() / 1000;
    if (now - lastSpawn.current > 0.7 + Math.random() * 0.6 && bursts.length < MAX_BURSTS) {
      lastSpawn.current = now;
      setBursts((prev) => [...prev, makeBurst(now)]);
    }
  });

  return (
    <>
      {bursts.map((b) => (
        <FireworkBurst
          key={b.startTime}
          burst={b}
          onExpire={() =>
            setBursts((prev) => prev.filter((x) => x.startTime !== b.startTime))
          }
        />
      ))}
    </>
  );
}

export default function HeroCanvas() {
  return (
    <div className="absolute inset-0">
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 8], fov: 55 }}
        dpr={[1, 1.75]}
      >
        <fog attach="fog" args={[staticShowCrafterPalette.night, 8, 22]} />
        <ambientLight intensity={0.4} />
        <Starfield />
        <BurstManager />
        <PointerCamera />
      </Canvas>
    </div>
  );
}
