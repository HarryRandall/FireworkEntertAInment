"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Pause, Play, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import * as THREE from "three";
import {
  addPreviewCueAction,
  deletePreviewCueAction,
  type CueActionResult,
} from "@/app/actions/preview-cues";
import { Badge, Eyebrow } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { NumberInput } from "@/app/components/ui/NumberInput";
import { SelectField } from "@/app/components/ui/SelectField";
import { StatTile } from "@/app/components/ui/StatTile";
import type {
  FireworkRenderSpec,
  FireworkSpecification,
  ReplayCue,
} from "@/lib/shows";
import { formatDuration } from "@/lib/shows";

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

type FireworkReplayViewerProps = {
  showId: string;
  showSlug: string;
  showName: string;
  durationSeconds: number | null;
  cues: ReplayCue[];
  specifications: FireworkSpecification[];
};

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
      if (cometMaterialRef.current) {
        cometMaterialRef.current.opacity = 0.9;
      }
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

function EmptyPreview() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-2xl border border-outline-variant/15 bg-surface-container-low/85 p-6 backdrop-blur">
        <Sparkles className="mx-auto mb-4 text-primary" size={28} />
        <h3 className="text-xl font-bold text-on-surface">
          No typed fireworks yet
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          Add a cue below, then drag the scene to orbit and scroll to zoom.
        </p>
      </div>
    </div>
  );
}

export function FireworkReplayViewer({
  showId,
  showSlug,
  showName,
  durationSeconds,
  cues,
  specifications,
}: FireworkReplayViewerProps) {
  const inferredDuration =
    cues.length > 0 ? Math.max(...cues.map((cue) => cue.timeSeconds)) + 5 : 30;
  const duration = Math.max(durationSeconds ?? inferredDuration, inferredDuration);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [actionResult, setActionResult] = useState<CueActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const startedAt = useRef<number | null>(null);
  const playheadStart = useRef(0);
  const elapsedRef = useRef(elapsed);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    startedAt.current = performance.now();
    playheadStart.current = elapsedRef.current;

    function tick(now: number) {
      if (startedAt.current == null) return;
      const next = Math.min(
        duration,
        playheadStart.current + (now - startedAt.current) / 1000,
      );
      setElapsed(next);
      if (next >= duration) {
        setIsPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isPlaying]);

  const sortedCues = useMemo(
    () => [...cues].sort((a, b) => a.timeSeconds - b.timeSeconds),
    [cues],
  );

  const activeCue = useMemo(() => {
    return [...sortedCues]
      .reverse()
      .find((cue) => cue.timeSeconds <= elapsed + 0.35);
  }, [sortedCues, elapsed]);

  const upcomingCues = useMemo(
    () => sortedCues.filter((cue) => cue.timeSeconds >= elapsed).slice(0, 5),
    [sortedCues, elapsed],
  );

  const hasReplayCues = cues.length > 0;

  function togglePlayback() {
    if (!hasReplayCues) return;
    if (elapsed >= duration) setElapsed(0);
    setIsPlaying((playing) => !playing);
  }

  function restart() {
    setIsPlaying(false);
    setElapsed(0);
  }

  function addCue(formData: FormData) {
    startTransition(async () => {
      const result = await addPreviewCueAction(formData);
      setActionResult(result);
      if (result.ok) formRef.current?.reset();
    });
  }

  function deleteCue(cueId: string) {
    const formData = new FormData();
    formData.set("cueId", cueId);
    formData.set("showSlug", showSlug);
    startTransition(async () => {
      setActionResult(await deletePreviewCueAction(formData));
    });
  }

  return (
    <div className="space-y-6">
      <Card
        elevation="low"
        radius="lg"
        className="overflow-hidden bg-gradient-to-b from-surface-container-high via-surface-container to-surface-container-low p-0 shadow-[var(--shadow-card-hover)]"
      >
        <div className="relative h-[min(72vh,680px)] min-h-[520px]">
          <div className="absolute left-6 top-6 z-10 space-y-2">
            <Badge tone={isPlaying ? "live" : "neutral"}>
              {isPlaying ? "Live replay" : "Interactive preview"}
            </Badge>
            <h2 className="max-w-xl text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
              {showName}
            </h2>
            <p className="max-w-sm text-xs font-medium text-on-surface-variant">
              Drag to orbit. Scroll to zoom. Use the timeline to scrub.
            </p>
          </div>

          <FireworkReplayCanvas cues={sortedCues} elapsed={elapsed} />

          {!hasReplayCues ? <EmptyPreview /> : null}
        </div>

        <div className="border-t border-outline-variant/15 bg-surface-container-low/90 px-5 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={togglePlayback}
              disabled={!hasReplayCues}
              aria-label={isPlaying ? "Pause preview" : "Play preview"}
              className="focus-glow-action flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)] transition-all focus:outline-none focus-visible:outline-none hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant/40 disabled:shadow-none"
            >
              {isPlaying ? (
                <Pause size={18} strokeWidth={2.5} />
              ) : (
                <Play size={18} strokeWidth={2.5} />
              )}
            </button>
            <button
              type="button"
              onClick={restart}
              aria-label="Restart preview"
              className="focus-glow-action flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline/20 text-primary transition-all focus:outline-none focus-visible:outline-none hover:bg-surface-container-highest/50 active:scale-[0.98]"
            >
              <RotateCcw size={16} strokeWidth={2} />
            </button>

            <div className="flex flex-1 items-center gap-3">
              <span className="font-mono text-[11px] tabular-nums text-tertiary/80 min-w-[2.75rem]">
                {formatDuration(elapsed)}
              </span>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.05}
                value={elapsed}
                onChange={(event) => {
                  setIsPlaying(false);
                  setElapsed(Number(event.target.value));
                }}
                className="h-2 flex-1 accent-tertiary"
                aria-label="Preview timeline"
              />
              <span className="font-mono text-[11px] tabular-nums text-tertiary/80 min-w-[2.75rem] text-right">
                {formatDuration(duration)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card elevation="high" radius="md" className="space-y-5 p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <Eyebrow tone="muted">Cue builder</Eyebrow>
              <h3 className="mt-2 text-2xl font-bold text-on-surface">
                Add or remove fireworks
              </h3>
            </div>
            {actionResult ? (
              <p
                className={
                  actionResult.ok
                    ? "text-sm font-semibold text-primary"
                    : "text-sm font-semibold text-error"
                }
              >
                {actionResult.ok ? actionResult.message : actionResult.error}
              </p>
            ) : null}
          </div>

          <form
            ref={formRef}
            action={addCue}
            className="grid grid-cols-1 gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 md:grid-cols-[1fr_140px_1.4fr_auto] md:items-end"
          >
            <input type="hidden" name="showId" value={showId} />
            <input type="hidden" name="showSlug" value={showSlug} />
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Firework
              </span>
              <SelectField
                name="fireworkSpecificationId"
                required
                placeholder="Select firework"
                defaultValue={specifications[0]?.id}
                options={specifications.map((spec) => ({
                  value: spec.id,
                  label: spec.name,
                }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Time
              </span>
              <NumberInput
                name="timeSeconds"
                min={0}
                max={duration}
                step={0.5}
                defaultValue={Math.min(duration, Math.round(elapsed + 3))}
                required
                ariaLabel="Cue time in seconds"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Label
              </span>
              <Input
                name="description"
                defaultValue="Custom firework cue"
                required
              />
            </label>
            <Button
              type="submit"
              disabled={isPending || specifications.length === 0}
            >
              <Plus size={16} strokeWidth={2} />
              Add
            </Button>
          </form>

          <div className="space-y-3">
            {sortedCues.length > 0 ? (
              sortedCues.map((cue) => (
                <div
                  key={cue.id}
                  className="flex flex-col gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-highest/60 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm font-bold text-tertiary tabular-nums">
                        {formatDuration(cue.timeSeconds)}
                      </span>
                      <span className="font-semibold text-on-surface">
                        {cue.firework.name}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {cue.firework.slug}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {cue.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCue(cue.id)}
                    disabled={isPending}
                    className="focus-glow-action inline-flex h-10 items-center justify-center gap-2 rounded-full border border-outline/20 px-4 text-sm font-semibold text-on-surface-variant transition-all focus:outline-none focus-visible:outline-none hover:bg-surface-container-high hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={15} strokeWidth={2} />
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                No cues yet. Add your first firework above to make the preview
                playable.
              </p>
            )}
          </div>
        </Card>

        <aside className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <StatTile label="Total effects" value={cues.length} />
            <StatTile label="Duration" value={formatDuration(duration)} />
            <StatTile
              label="Active cue"
              value={activeCue ? activeCue.firework.name : "—"}
            />
          </div>

          <Card elevation="high" radius="md" className="space-y-4 p-5">
            <Eyebrow tone="muted">Firework types</Eyebrow>
            <div className="space-y-3">
              {specifications.map((spec) => (
                <div
                  key={spec.id}
                  className="rounded-lg border border-outline-variant/10 bg-surface-container-highest/70 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-on-surface">
                      {spec.name}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {spec.slug}
                    </span>
                  </div>
                  {spec.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                      {spec.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card elevation="low" radius="md" className="space-y-4 p-5">
            <Eyebrow tone="muted">Upcoming cues</Eyebrow>
            {upcomingCues.length > 0 ? (
              <ol className="space-y-2">
                {upcomingCues.map((cue) => (
                  <li
                    key={cue.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-surface-container-highest/60 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {cue.firework.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                        {cue.description}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-tertiary tabular-nums">
                      {formatDuration(cue.timeSeconds)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm leading-relaxed text-on-surface-variant">
                No upcoming typed cues at this playhead position.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
