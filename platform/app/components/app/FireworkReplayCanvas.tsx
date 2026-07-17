'use client';

/**
 * FireworkReplayCanvas — Three.js canvas that simulates firework cues
 * for a given `elapsed` time. Used inside FireworkReplayViewer and
 * TemplateReplayPreview. Owns its own renderer/engine lifecycle and
 * is intentionally `dynamic`-imported by parents to avoid SSR.
 */
import { type MutableRefObject, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Axis3d,
  Hand,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { ReplayCue } from '@/lib/show-domain';
import { FireworksEngine, type SnapshotCacheData } from '@/lib/fireworks/FireworksEngine';
import type { FireworkSceneMode } from '@/lib/fireworks/World';
import {
  DEFAULT_LAUNCH_POSITIONS,
  type FireworkDesign,
  type LaunchPosition,
} from '@/lib/fireworks/design';
import {
  DEFAULT_FIREWORK_HEAD_STYLE,
  DEFAULT_FIREWORK_RENDER_TUNING,
  type FireworkHeadStyle,
  type FireworkRenderTuning,
} from '@/lib/fireworks/render-tuning';
import { replaySimulationCacheKey } from '@/lib/fireworks/replay-cache-key';
import {
  FIREWORKS_ENGINE_FIXED_STEP_SECONDS,
  quantiseFireworksEngineTimeSeconds,
} from '@/lib/fireworks/import-renderer-contract';
import { Button } from '@/app/components/ui/Button';
import { ReplayLoadingBar } from '@/app/components/app/ReplayLoadingBar';
import { cn } from '@/lib/utils';

// Wall-clock budget per frame for the async snapshot prime, balancing how fast
// fireworks load against keeping the loop responsive while the bar animates.
const PRIME_BUDGET_MS = 8;
// The post-drag repair gets a larger slice than the prime: it gates playback
// resuming at full fidelity, so finishing a frame or two sooner matters more
// than the small hit to interaction smoothness while it runs.
const REPAIR_BUDGET_MS = 12;

// Module-level cache of primed snapshot caches, keyed by a content signature of
// the cue set. The canvas module stays loaded across client navigations within
// a tab, so this lets a quick leave-and-return to the same show skip the silent
// full-show prime entirely (no loading bar) instead of re-running it on every
// mount. Capped at one entry to bound memory: each entry holds the packed
// particle buffers for every half-second of a show, which can run to tens of MB.
const MAX_CACHED_SHOWS = 1;
const CAMERA_MENU_ANIMATION_MS = 180;
const snapshotCacheByKey = new Map<string, SnapshotCacheData>();

function rememberSnapshotCache(key: string, cache: SnapshotCacheData): void {
  if (cache.snapshots.length === 0) return;
  // Move-to-front so the most recently primed show survives eviction.
  snapshotCacheByKey.delete(key);
  snapshotCacheByKey.set(key, cache);
  while (snapshotCacheByKey.size > MAX_CACHED_SHOWS) {
    const oldest = snapshotCacheByKey.keys().next().value;
    if (oldest === undefined) break;
    snapshotCacheByKey.delete(oldest);
  }
}

type Props = {
  cues: ReplayCue[];
  elapsed: number;
  /** Optional 60Hz playhead ref. When provided, the engine reads from it
   * instead of the throttled `elapsed` prop — letting parents update React
   * state at a lower rate while keeping playback smooth. */
  playbackRef?: MutableRefObject<number>;
  /**
   * True while the user is dragging the timeline. Puts the engine in scrub
   * mode: seeks accept fast lossy snapshot restores (never a from-zero
   * rebuild). When the drag ends the engine re-seeks accurately to repair
   * any lossy state.
   */
  scrubbing?: boolean;
  launchPositions?: LaunchPosition[];
  muted?: boolean;
  interactive?: boolean;
  allowWheelZoom?: boolean;
  controlsVisible?: boolean;
  showCameraControls?: boolean;
  cameraMenuActions?: FireworkReplayCanvasMenuAction[];
  showFps?: boolean;
  /** Upper bound for renderer DPR. Lower values are useful for large public previews. */
  maxDevicePixelRatio?: number;
  /**
   * Request a multisampled render context. Off by default to keep the
   * full-show player and editors cheap; card hover previews opt in so small
   * canvases do not show aliased star edges when blown up by the browser.
   */
  antialias?: boolean;
  /**
   * Pre-run the whole show silently on cue load and cache a particle snapshot
   * every second, so timeline seeks land near a snapshot instead of rebuilding
   * from zero. Intended for full-show previews where scrubbing matters; leave
   * off for short single-firework editors.
   */
  primeSnapshots?: boolean;
  /**
   * When `primeSnapshots` is on, keep re-priming as `cues` change so seeks stay
   * fast after a cue edit. Set false for the single-firework admin editors,
   * which rebuild their one cue on every slider tick: they prime once on mount
   * (for the loading bar and the come-back cache) then skip the per-edit prime
   * to avoid drag jank, accepting from-zero seeks after each edit.
   */
  primeOnCueChanges?: boolean;
  renderTuning?: Partial<FireworkRenderTuning>;
  headStyle?: Partial<FireworkHeadStyle>;
  trailWidthGuideDesign?: FireworkDesign | null;
  /**
   * Render extra horizontal WebGL width while the visible frame clips the middle.
   * Multishot uses this so opening the side inspector keeps the scene scale
   * stable without pushing the mortar off-centre.
   */
  renderOverscanPx?: number;
  /**
   * Fired once after the canvas mounts and the empty scene is first rendered,
   * before any fireworks are loaded. Parents can use this to drop a placeholder
   * so the user can see (and orbit) the scene while cues are still priming.
   */
  onSceneReady?: () => void;
  /**
   * Fired with `null` when no prime is in flight, and with a 0..1 fraction as
   * the async snapshot prime advances, so parents can render a determinate
   * loading bar while fireworks load.
   */
  onPrimeProgress?: (progress: number | null) => void;
  /**
   * Whether the current `cues` are the final set the parent intends to show.
   * When streaming cues, keep this false until the data lands so the canvas
   * does not report `onReady` on the initial empty scene. Defaults to true for
   * non-streaming callers.
   */
  cuesFinal?: boolean;
  onReady?: () => void;
  /**
   * Render the canvas's built-in loading bar overlay while fireworks are
   * loading (before `onReady` fires). On by default so every visible firework
   * preview, admin or customer-facing, has consistent loading feedback. Hidden
   * render jobs can explicitly disable it to keep captured frames clean.
   */
  showLoadingBar?: boolean;
  /**
   * Where the built-in loading bar floats. `bottom` sits in the playback slot
   * (show viewer, import preview); `center` floats mid-stage so it clears the
   * always-on transport strip in the admin editors.
   */
  loadingBarPosition?: 'bottom' | 'center';
  /**
   * Show the in-canvas fullscreen toggle (top-right) and let this canvas drive
   * a parent-owned fullscreen overlay. Off by default so decorative card
   * previews and admin editors are unaffected.
   */
  allowFullscreen?: boolean;
  /** Controlled fullscreen flag; the parent owns the overlay chrome. */
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Show the decorative sky starfield behind the stage. */
  showStarfield?: boolean;
  /**
   * Keep the WebGL drawing buffer so `canvas.toDataURL()` returns the last
   * rendered frame. Off by default (a small perf/memory cost); the offscreen
   * stage-poster capture opts in so it can screenshot the empty scene.
   */
  preserveDrawingBuffer?: boolean;
  /**
   * Exposes deterministic, non-interactive frame capture to the protected
   * import validator. The controller advances the same engine and composer as
   * the visible replay, and is never enabled by normal replay consumers.
   */
  onCaptureController?: (controller: FireworkReplayCaptureController | null) => void;
  /**
   * Aim-direction overlay for the multishot editor. When provided, a marker is
   * drawn from the shared mortar for each shot and the canvas becomes
   * pickable: clicking a marker selects it, and (with `repositionMarkerId` set)
   * dragging changes that shot's pan/tilt. Absent by default, so every other
   * consumer of this canvas is unaffected.
   */
  aimMarkers?: AimMarker[];
  selectedMarkerId?: string | null;
  onSelectMarker?: (id: string | null) => void;
  /** When set, dragging the canvas repositions this marker instead of orbiting. */
  repositionMarkerId?: string | null;
  /** Fired continuously while dragging a marker in reposition mode. */
  onRepositionMarker?: (id: string, panDegrees: number, tiltDegrees: number) => void;
  /** Fired once on pointer-up after a reposition drag, for persistence. */
  onRepositionCommit?: (id: string, panDegrees: number, tiltDegrees: number) => void;
};

export type FireworkReplayCapturedFrame = {
  elapsedSeconds: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  pngBase64: string | null;
  stats: ReturnType<FireworksEngine['getStats']>;
};

export type FireworkReplayCaptureController = {
  captureAt(
    elapsedSeconds: number,
    options?: { includePng?: boolean },
  ): FireworkReplayCapturedFrame;
  reset(): void;
};

// Cap at 2 so Retina displays render at native density; anything above 2
// costs quadratic fill rate (and a full-resolution bloom pass) for detail the
// eye cannot resolve. Values below the display ratio leave the browser
// upscaling the canvas, which reads as a blurry preview.
const MAX_DEVICE_PIXEL_RATIO = 2;
// Orbit centre sits at y=1000 (upper-show). Camera is low and pulled back so the
// default looks up into the show from below; zooming in tracks toward the centre
// and is stopped by the keep-out sphere before it rises into the burst. At this
// target height the default distance (~3000) is right at the zoom-out limit.
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 64, 2850);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 1000, 0);
const GROUND_PLANE_Y = 0;
const MIN_CAMERA_HEIGHT = 24;
// How far past horizontal (radians) the orbit may dip before the hard ceiling.
// This is the "go a bit more" travel: once the camera reaches the floor the rig
// pans upward through this band instead of dead-stopping. Larger = more travel.
const ORBIT_FLOOR_OVERSHOOT = 0.35;
// Zoom envelope: keep the camera inside the band where point sprites read well.
// MIN_CAMERA_DISTANCE is a keep-out sphere around the target so you cannot fly
// into the particles; past ~3000 the preview loses the floor and burst
// proportions the editor needs.
const MIN_CAMERA_DISTANCE = 600;
const MAX_CAMERA_DISTANCE = 3000;
const BLOOM_STRENGTH = 0.38;
const BLOOM_RADIUS = 0.18;
const BLOOM_THRESHOLD = 0.52;
const FPS_SAMPLE_WINDOW_MS = 100;
const FPS_HISTORY_SIZE = 80;
const FPS_GRAPH_WIDTH = 184;
const FPS_GRAPH_HEIGHT = 40;
const FPS_GRAPH_MAX = 120;
const FPS_CURVE_TENSION = 0.22;
const FPS_SMOOTHING_FACTOR = 0.16;
const TRAIL_WIDTH_GUIDE_RINGS = 7;
const TRAIL_WIDTH_GUIDE_SEGMENTS = 10;
const TRAIL_WIDTH_GUIDE_MATERIAL_OPACITY = 0.58;
const TRAIL_WIDTH_GUIDE_STAR_INDEX = 0;
const TRAIL_WIDTH_GUIDE_MAX_SPREAD_ANGLE = 80;
const TRAIL_WIDTH_GUIDE_SPREAD_SCALE = 0.055;
const TRAIL_WIDTH_GUIDE_MAX_SPREAD = 180;
const GUIDE_GRAVITY = -9.82;
const GUIDE_STAR_MIN_GRAVITY = -1.85;
const GUIDE_STAR_MAX_GRAVITY = 0.28;
const PATTERN_SEED: Record<FireworkDesign['pattern'], 1 | 2 | 3> = {
  fibonacci: 1,
  wave: 2,
  strobe: 3,
};

/**
 * Pan the whole camera rig (camera + target together) up by `lift` units. Used
 * by the floor-pan in the render loop: because both move by the same amount the
 * camera-to-target offset, and therefore the orbit angle, is preserved.
 */
function liftCameraRig(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  lift: number,
): void {
  camera.position.y += lift;
  controls.target.y += lift;
}

type FpsGraphPoint = {
  x: number;
  y: number;
};

function fpsSampleToY(value: number): number {
  const clamped = Math.max(0, Math.min(FPS_GRAPH_MAX, value));
  return FPS_GRAPH_HEIGHT - (clamped / FPS_GRAPH_MAX) * FPS_GRAPH_HEIGHT;
}

function buildFpsGraphPoints(samples: number[], currentFps: number | null): FpsGraphPoint[] {
  const values = samples.length > 0 ? samples : currentFps == null ? [0] : [currentFps];
  const step = FPS_GRAPH_WIDTH / (FPS_HISTORY_SIZE - 1);

  return values.map((value, index) => ({
    x: FPS_GRAPH_WIDTH - (values.length - 1 - index) * step,
    y: fpsSampleToY(value),
  }));
}

function buildFpsGraphPath(samples: number[], currentFps: number | null): string {
  const points = buildFpsGraphPoints(samples, currentFps);
  if (points.length === 1) {
    const [{ y }] = points;
    return `M ${(FPS_GRAPH_WIDTH - 1).toFixed(2)} ${y.toFixed(2)} L ${FPS_GRAPH_WIDTH.toFixed(
      2,
    )} ${y.toFixed(2)}`;
  }

  const [first] = points;
  return points.slice(1).reduce(
    (path, point, index) => {
      const pointIndex = index + 1;
      const previous = points[pointIndex - 1];
      const beforePrevious = points[pointIndex - 2] ?? previous;
      const afterPoint = points[pointIndex + 1] ?? point;
      const cp1x = previous.x + (point.x - beforePrevious.x) * FPS_CURVE_TENSION;
      const cp1y = previous.y + (point.y - beforePrevious.y) * FPS_CURVE_TENSION;
      const cp2x = point.x - (afterPoint.x - previous.x) * FPS_CURVE_TENSION;
      const cp2y = point.y - (afterPoint.y - previous.y) * FPS_CURVE_TENSION;

      return `${path} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(
        2,
      )} ${cp2y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    },
    `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rangeMid(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

function trailWidthGuideRadiusAt(
  design: FireworkDesign,
  positionPercent: number,
  distanceBehindHead: number,
  visibleTrailLength: number,
): number {
  const width = design.burstTrail.width;
  const t = Math.pow(clamp01(positionPercent / 100), width.curve);
  const tailAngle = clamp(width.tail, 0, TRAIL_WIDTH_GUIDE_MAX_SPREAD_ANGLE);
  const frontAngle = clamp(width.front, 0, TRAIL_WIDTH_GUIDE_MAX_SPREAD_ANGLE);
  const frontDistance = Math.max(0, visibleTrailLength - distanceBehindHead);
  const tailRadius =
    Math.tan((tailAngle * Math.PI) / 180) *
    distanceBehindHead *
    TRAIL_WIDTH_GUIDE_SPREAD_SCALE *
    (1 - t);
  const frontRadius =
    Math.tan((frontAngle * Math.PI) / 180) * frontDistance * TRAIL_WIDTH_GUIDE_SPREAD_SCALE * t;
  const radius = tailRadius + frontRadius;
  return clamp(radius, 0, TRAIL_WIDTH_GUIDE_MAX_SPREAD);
}

function fibonacciDirection(index: number, count: number): THREE.Vector3 {
  const offset = 2 / count;
  const inc = Math.PI * (3.0 - Math.sqrt(5.0));
  const y = index * offset - 1 + offset / 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = ((index + 1.0) % count) * inc;
  return new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
}

function burstParticleCount(design: FireworkDesign): number {
  switch (design.geometry) {
    case 'radial_arms':
      return Math.max(1, Math.round(design.size * 0.46));
    case 'falling_tail':
      return Math.max(1, Math.round(design.size * 0.62));
    case 'pearls':
      return Math.max(1, Math.round(design.size * 0.18));
    case 'ring':
      return Math.max(1, Math.round(design.size * 0.72));
    case 'bowtie':
      return Math.max(1, Math.round(design.size * 0.82));
    case 'fragment_cloud':
      return Math.max(1, Math.round(design.size * 0.9));
    default:
      return Math.max(1, Math.round(design.size));
  }
}

function buildTrailWidthGuideVelocity(design: FireworkDesign): THREE.Vector3 {
  const speed = rangeMid(design.burst.speed);
  if (design.geometry === 'upward_fan') return new THREE.Vector3(0, speed * 1.625, 0);
  if (design.geometry === 'single_tail') return new THREE.Vector3(0, speed * 0.2, speed);

  const count = burstParticleCount(design);
  const index = Math.min(TRAIL_WIDTH_GUIDE_STAR_INDEX, count - 1);
  const direction = fibonacciDirection(index, count);

  switch (design.geometry) {
    case 'ring': {
      const angle = (index / count) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed * 0.96, 0);
    }
    case 'crown':
    case 'weeping': {
      const lateral = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1;
      const lift = design.geometry === 'weeping' ? 0.575 : 0.86;
      return new THREE.Vector3(
        (direction.x / lateral) * speed * 0.825,
        speed * lift,
        (direction.z / lateral) * speed * 0.825,
      );
    }
    case 'radial_arms': {
      const arms = 7;
      const arm = index % arms;
      const angle = (arm / arms) * Math.PI * 2;
      const length = 0.74 + Math.floor(index / arms) / Math.max(1, count / arms);
      return new THREE.Vector3(
        Math.cos(angle) * speed * length,
        speed * 0.44,
        Math.sin(angle) * speed * length,
      );
    }
    case 'falling_tail': {
      const lateral = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1;
      return new THREE.Vector3(
        (direction.x / lateral) * speed * 0.53,
        -speed * 0.26,
        (direction.z / lateral) * speed * 0.53,
      );
    }
    case 'pearls': {
      const angle = (index / count) * Math.PI * 2;
      return new THREE.Vector3(
        Math.cos(angle) * speed * 0.59,
        speed * 0.675,
        Math.sin(angle) * speed * 0.59,
      );
    }
    case 'fragment_cloud':
      return direction.multiplyScalar(speed * 1.11);
    case 'bowtie': {
      const half = Math.floor(count / 2);
      const lobe = index < half ? 1 : -1;
      const withinLobe = lobe === 1 ? index : index - half;
      const lobeCount = lobe === 1 ? half : count - half;
      const t = lobeCount > 1 ? withinLobe / (lobeCount - 1) : 0.5;
      const fan = (t - 0.5) * Math.PI * 0.62;
      return new THREE.Vector3(
        lobe * Math.cos(fan) * speed * 0.92,
        Math.sin(fan) * speed * 0.34,
        0,
      );
    }
    default: {
      const warble = PATTERN_SEED[design.pattern] === 2 ? 1.03 : 1;
      return direction.multiplyScalar(speed * warble);
    }
  }
}

function guideStarGravity(design: FireworkDesign): number {
  const gravity = clamp(
    rangeMid(design.burst.gravity),
    GUIDE_STAR_MIN_GRAVITY,
    GUIDE_STAR_MAX_GRAVITY,
  );
  switch (design.geometry) {
    case 'weeping':
      return clamp(gravity * 0.52, GUIDE_STAR_MIN_GRAVITY, -0.08);
    case 'falling_tail':
    case 'waterfall':
      return clamp(gravity * 0.45, GUIDE_STAR_MIN_GRAVITY, -0.05);
    case 'pearls':
      return clamp(gravity * 1.15, GUIDE_STAR_MIN_GRAVITY, -0.18);
    default:
      return gravity;
  }
}

function shellApexSeconds(design: FireworkDesign, cue?: ReplayCue): number {
  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  const panRadians = ((cue?.shotPanDegrees ?? 0) * Math.PI) / 180;
  const vy = liftVelocity * Math.max(0.82, Math.cos(panRadians) * 0.96);
  return Math.max(0, vy / Math.abs(GUIDE_GRAVITY));
}

function trailWidthGuideBurstCentre(
  design: FireworkDesign,
  cues: ReplayCue[],
  launchPositions: LaunchPosition[],
): THREE.Vector3 {
  const cue = cues[0];
  const idx = cue?.launchPositionIndex ?? 0;
  const basePos = launchPositions[idx] ?? DEFAULT_LAUNCH_POSITIONS[0];
  const override = cue?.shotPositionOverride;
  const x = basePos.x + (override?.x ?? 0);
  const y = basePos.y + (override?.y ?? 0);
  const z = basePos.z + (override?.z ?? 0);
  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  const panRadians = ((cue?.shotPanDegrees ?? 0) * Math.PI) / 180;
  const tiltRadians = ((cue?.shotTiltDegrees ?? 0) * Math.PI) / 180;
  const vx = Math.sin(panRadians) * Math.max(1.2, liftVelocity * 0.62);
  const vz = Math.sin(tiltRadians) * Math.max(1.0, liftVelocity * 0.42);
  const vy = liftVelocity * Math.max(0.82, Math.cos(panRadians) * 0.96);
  const apexSeconds = shellApexSeconds(design, cue);

  return new THREE.Vector3(
    x + vx * apexSeconds * 100,
    y + (vy * apexSeconds + 0.5 * GUIDE_GRAVITY * apexSeconds * apexSeconds) * 100,
    z + vz * apexSeconds * 100,
  );
}

function pushLine(vertices: number[], a: THREE.Vector3, b: THREE.Vector3): void {
  vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
}

function createTrailWidthGuide(
  design: FireworkDesign,
  elapsed: number,
  cues: ReplayCue[],
  launchPositions: LaunchPosition[],
): THREE.Group | null {
  if (!design.burstTrail.enabled || design.burstTrail.particlesPerStar <= 0) return null;

  const cue = cues[0];
  const starAge = Math.max(0, elapsed - (cue?.timeSeconds ?? 0) - shellApexSeconds(design, cue));
  const starLife = Math.max(0.01, rangeMid(design.burst.life));
  const visibleAge = Math.min(starAge, starLife);
  if (visibleAge <= 0) return null;

  const velocity = buildTrailWidthGuideVelocity(design);
  const displacement = velocity
    .clone()
    .multiplyScalar(visibleAge * 100)
    .add(new THREE.Vector3(0, 0.5 * guideStarGravity(design) * visibleAge * visibleAge * 100, 0));
  const pathLength = displacement.length();
  if (pathLength <= 1) return null;

  const direction = displacement.normalize();
  const burstCentre = trailWidthGuideBurstCentre(design, cues, launchPositions);
  const vertices: number[] = [];

  const worldUp =
    Math.abs(direction.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(direction, worldUp);
  if (right.lengthSq() < 1e-5) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, direction).normalize();
  let previousRing: THREE.Vector3[] | null = null;

  for (let ringIndex = 0; ringIndex < TRAIL_WIDTH_GUIDE_RINGS; ringIndex++) {
    const progress = ringIndex / (TRAIL_WIDTH_GUIDE_RINGS - 1);
    const distanceBehindHead = pathLength * (1 - progress);
    const radius = Math.max(
      0,
      trailWidthGuideRadiusAt(design, progress * 100, distanceBehindHead, pathLength),
    );
    const centre = burstCentre.clone().addScaledVector(direction, pathLength * progress);
    const ring = Array.from({ length: TRAIL_WIDTH_GUIDE_SEGMENTS }, (_, segmentIndex) => {
      const angle = (segmentIndex / TRAIL_WIDTH_GUIDE_SEGMENTS) * Math.PI * 2;
      return centre
        .clone()
        .addScaledVector(right, Math.cos(angle) * radius)
        .addScaledVector(up, Math.sin(angle) * radius);
    });

    for (let segmentIndex = 0; segmentIndex < TRAIL_WIDTH_GUIDE_SEGMENTS; segmentIndex++) {
      pushLine(vertices, ring[segmentIndex], ring[(segmentIndex + 1) % TRAIL_WIDTH_GUIDE_SEGMENTS]);
      if (previousRing) pushLine(vertices, previousRing[segmentIndex], ring[segmentIndex]);
    }

    previousRing = ring;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x9eefff,
    transparent: true,
    opacity: TRAIL_WIDTH_GUIDE_MATERIAL_OPACITY,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'trail-width-guide-lines';
  lines.renderOrder = 9;

  const group = new THREE.Group();
  group.name = 'trail-width-guide';
  group.userData.trailWidthGuide = true;
  group.add(lines);
  return group;
}

function disposeTrailWidthGuide(group: THREE.Group | null): void {
  if (!group) return;
  group.traverse((child) => {
    const object = child as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    object.geometry?.dispose();
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose());
    } else {
      object.material?.dispose();
    }
  });
}

export type FireworkReplayCanvasMenuAction = {
  id: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  icon: ReactNode;
};

/**
 * A single aim marker for the multishot editor: one shot's launch direction
 * from the shared mortar, described by its pan (left/right) and tilt
 * (toward/away) in degrees. Purely an editor overlay; it does not affect the
 * simulated show, which reads pan/tilt from each cue.
 */
export type AimMarker = {
  id: string;
  panDegrees: number;
  tiltDegrees: number;
  color?: string | null;
  label?: string | null;
  /**
   * World-space centre of the shot's burst. When provided, the marker sits
   * exactly where the firework pops; otherwise it falls back to a fixed-length
   * aim ray from the mortar.
   */
  position?: { x: number; y: number; z: number } | null;
};

// Overlay geometry constants. The mortar sits at the world origin and the aim
// line reaches up toward the burst band (orbit target is y=1000).
const AIM_MARKER_LENGTH = 1500;
const AIM_MARKER_HANDLE_RADIUS_SELECTED = 104;
// Invisible but pickable hit sphere around each shot's burst, so any firework
// can be clicked to select it even though only the selected one is drawn.
const AIM_MARKER_PICK_RADIUS = 150;
const AIM_MARKER_DEFAULT_COLOR = 0x8ad7ff;
// Degrees of pan/tilt per pixel dragged while repositioning a marker in 3D.
const AIM_REPOSITION_PAN_PER_PX = 0.32;
const AIM_REPOSITION_TILT_PER_PX = 0.28;
// A pointer that moves less than this (px) between down and up counts as a click
// (used to distinguish selecting a marker from orbiting the camera).
const AIM_CLICK_SLOP_PX = 5;

function clampPan(value: number): number {
  return Math.max(-180, Math.min(180, value));
}

function clampTilt(value: number): number {
  return Math.max(-90, Math.min(90, value));
}

/** Unit direction a shot is aimed, mirroring how the sim offsets a burst. */
function aimMarkerDirection(panDegrees: number, tiltDegrees: number): THREE.Vector3 {
  const pan = (panDegrees * Math.PI) / 180;
  const tilt = (tiltDegrees * Math.PI) / 180;
  return new THREE.Vector3(
    Math.sin(pan),
    Math.max(0.35, Math.cos(pan)),
    Math.sin(tilt),
  ).normalize();
}

function aimMarkerEndpoint(marker: AimMarker): THREE.Vector3 {
  if (marker.position) {
    return new THREE.Vector3(marker.position.x, marker.position.y, marker.position.z);
  }
  return aimMarkerDirection(marker.panDegrees, marker.tiltDegrees).multiplyScalar(
    AIM_MARKER_LENGTH,
  );
}

function buildAimMarkerGroup(markers: AimMarker[], selectedId: string | null): THREE.Group {
  const group = new THREE.Group();
  group.name = 'aim-markers';
  group.userData.aimMarkers = true;

  for (const marker of markers) {
    const endpoint = aimMarkerEndpoint(marker);
    // Invisible hit target at the burst centre so every shot stays clickable
    // even though only the selected marker is drawn.
    const pickGeometry = new THREE.SphereGeometry(AIM_MARKER_PICK_RADIUS, 12, 12);
    const pickMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const pick = new THREE.Mesh(pickGeometry, pickMaterial);
    pick.position.copy(endpoint);
    pick.renderOrder = 20;
    pick.userData.aimMarkerId = marker.id;
    group.add(pick);

    if (marker.id !== selectedId) continue;

    // Only the selected shot draws a visible ring, halo, and aim line so the
    // preview stays uncluttered.
    const color = new THREE.Color(marker.color ?? undefined);
    if (!marker.color) color.setHex(AIM_MARKER_DEFAULT_COLOR);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, endpoint.x, endpoint.y, endpoint.z], 3),
    );
    const lineMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.renderOrder = 21;
    group.add(line);

    // A thin ring around the burst rather than a solid dot, so the firework
    // itself stays visible inside the selection marker.
    const ringGeometry = new THREE.TorusGeometry(AIM_MARKER_HANDLE_RADIUS_SELECTED, 8, 12, 40);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(endpoint);
    ring.renderOrder = 23;
    ring.userData.aimMarkerId = marker.id;
    ring.userData.aimMarkerBillboard = true;
    group.add(ring);

    const haloGeometry = new THREE.SphereGeometry(AIM_MARKER_HANDLE_RADIUS_SELECTED + 30, 22, 22);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.position.copy(endpoint);
    halo.renderOrder = 21;
    halo.userData.aimMarkerId = marker.id;
    group.add(halo);
  }

  return group;
}

function orientAimMarkerBillboards(group: THREE.Group | null, camera: THREE.Camera): void {
  if (!group) return;
  for (const child of group.children) {
    if (child.userData?.aimMarkerBillboard) child.quaternion.copy(camera.quaternion);
  }
}

function aimMarkersSignature(markers: AimMarker[]): string {
  return markers
    .map((m) => {
      const p = m.position;
      const pos = p ? `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}` : '';
      return `${m.id}:${m.panDegrees}:${m.tiltDegrees}:${m.color ?? ''}:${pos}`;
    })
    .join('|');
}

export function FireworkReplayCanvas({
  cues,
  elapsed,
  playbackRef,
  scrubbing = false,
  launchPositions = DEFAULT_LAUNCH_POSITIONS,
  muted = false,
  interactive = true,
  allowWheelZoom = true,
  controlsVisible = true,
  showCameraControls = true,
  cameraMenuActions = [],
  showFps = false,
  maxDevicePixelRatio = MAX_DEVICE_PIXEL_RATIO,
  antialias = false,
  primeSnapshots = false,
  primeOnCueChanges = true,
  renderTuning = DEFAULT_FIREWORK_RENDER_TUNING,
  headStyle = DEFAULT_FIREWORK_HEAD_STYLE,
  trailWidthGuideDesign = null,
  renderOverscanPx = 0,
  onSceneReady,
  onPrimeProgress,
  cuesFinal = true,
  onReady,
  showLoadingBar = true,
  loadingBarPosition = 'bottom',
  allowFullscreen = false,
  fullscreen = false,
  onToggleFullscreen,
  showStarfield = true,
  preserveDrawingBuffer = false,
  onCaptureController,
  aimMarkers,
  selectedMarkerId = null,
  onSelectMarker,
  repositionMarkerId = null,
  onRepositionMarker,
  onRepositionCommit,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FireworksEngine | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const trailWidthGuideRef = useRef<THREE.Group | null>(null);
  const aimMarkersGroupRef = useRef<THREE.Group | null>(null);
  const aimMarkersRef = useRef<AimMarker[]>(aimMarkers ?? []);
  const selectedMarkerIdRef = useRef<string | null>(selectedMarkerId);
  const repositionMarkerIdRef = useRef<string | null>(repositionMarkerId);
  const onSelectMarkerRef = useRef(onSelectMarker);
  const onRepositionMarkerRef = useRef(onRepositionMarker);
  const onRepositionCommitRef = useRef(onRepositionCommit);
  const [sceneReady, setSceneReady] = useState(false);
  const rafRef = useRef<number | null>(null);
  const internalElapsedRef = useRef(elapsed);
  const showFpsRef = useRef(showFps);
  const fpsFrameCountRef = useRef(0);
  const fpsSampleStartedAtRef = useRef(0);
  const fpsSmoothedRef = useRef<number | null>(null);
  const forceRenderRef = useRef(true);
  const interactionRenderUntilRef = useRef(0);
  // Current upward pan applied to keep the camera off the floor (see loop).
  const floorLiftRef = useRef(0);
  const showViewHelperRef = useRef(false);
  const hasReportedReadyRef = useRef(false);
  const hasReportedSceneReadyRef = useRef(false);
  const lastReportedPrimeProgressRef = useRef(0);
  // Cache key for the prime currently in flight, so the RAF loop can store the
  // finished snapshot cache under the right signature when priming completes.
  const primeCacheKeyRef = useRef<string>('');
  // Signature of the last cue set + options actually applied to the engine, so
  // referential churn from parent re-renders cannot re-clear the scene.
  const appliedCuesSignatureRef = useRef<string>('');
  const appliedLaunchPositionsSignatureRef = useRef<string>('');
  const onSceneReadyRef = useRef(onSceneReady);
  const onPrimeProgressRef = useRef(onPrimeProgress);
  const cuesFinalRef = useRef(cuesFinal);
  const [panMode, setPanMode] = useState(false);
  const [showViewHelper, setShowViewHelper] = useState(false);
  const [sceneMode, setSceneMode] = useState<FireworkSceneMode>('night');
  const [showFpsOverlay, setShowFpsOverlay] = useState(showFps);
  // Camera-controls reveal state. Hover and keyboard focus can preview the rail;
  // clicking the gear can explicitly open or close it without hover fighting the
  // user's click.
  const [menuHovered, setMenuHovered] = useState(false);
  const [gearFocused, setGearFocused] = useState(false);
  const [menuPinned, setMenuPinned] = useState(false);
  const [menuHoverSuppressed, setMenuHoverSuppressed] = useState(false);
  const menuVisibleRef = useRef(false);
  const menuVisibleBeforePressRef = useRef<boolean | null>(null);
  const gearClusterRef = useRef<HTMLDivElement | null>(null);
  const menuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [fpsSamples, setFpsSamples] = useState<number[]>([]);
  // Internal loading-bar state. `loadingBarVisible` mirrors `!hasReportedReady`
  // (false once the canvas settles on a final cue set) and `loadingProgress`
  // is null (indeterminate "Preparing preview") until the async prime starts,
  // then 0..1 ("Loading fireworks"). Kept here so every consumer gets the bar
  // by passing `showLoadingBar` instead of wiring its own progress state.
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [loadingBarVisible, setLoadingBarVisible] = useState(showLoadingBar);
  const onReadyRef = useRef(onReady);
  const onCaptureControllerRef = useRef(onCaptureController);
  const glowPadding = renderTuning.glowPadding ?? DEFAULT_FIREWORK_RENDER_TUNING.glowPadding;
  const whiteCoreSizePercent =
    renderTuning.whiteCoreSizePercent ?? DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreSizePercent;
  const whiteCoreBlurPercent =
    renderTuning.whiteCoreBlurPercent ?? DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreBlurPercent;
  const coreSoftness = headStyle.coreSoftness ?? DEFAULT_FIREWORK_HEAD_STYLE.coreSoftness;
  const coreBrightness = headStyle.coreBrightness ?? DEFAULT_FIREWORK_HEAD_STYLE.coreBrightness;
  const coreOpacityFalloff =
    headStyle.coreOpacityFalloff ?? DEFAULT_FIREWORK_HEAD_STYLE.coreOpacityFalloff;
  const glowSize = headStyle.glowSize ?? DEFAULT_FIREWORK_HEAD_STYLE.glowSize;
  const glowSoftness = headStyle.glowSoftness ?? DEFAULT_FIREWORK_HEAD_STYLE.glowSoftness;
  const glowOpacityFalloff =
    headStyle.glowOpacityFalloff ?? DEFAULT_FIREWORK_HEAD_STYLE.glowOpacityFalloff;
  const glowBlur = headStyle.glowBlur ?? DEFAULT_FIREWORK_HEAD_STYLE.glowBlur;
  const backgroundGlowOpacityFalloff =
    headStyle.backgroundGlowOpacityFalloff ??
    DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowOpacityFalloff;
  const backgroundGlowSoftness =
    headStyle.backgroundGlowSoftness ?? DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowSoftness;

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    onCaptureControllerRef.current = onCaptureController;
  }, [onCaptureController]);
  useEffect(() => {
    onSceneReadyRef.current = onSceneReady;
  }, [onSceneReady]);
  useEffect(() => {
    onPrimeProgressRef.current = onPrimeProgress;
  }, [onPrimeProgress]);
  useEffect(() => {
    cuesFinalRef.current = cuesFinal;
  }, [cuesFinal]);
  useEffect(() => {
    onSelectMarkerRef.current = onSelectMarker;
    onRepositionMarkerRef.current = onRepositionMarker;
    onRepositionCommitRef.current = onRepositionCommit;
  }, [onSelectMarker, onRepositionMarker, onRepositionCommit]);
  useEffect(() => {
    aimMarkersRef.current = aimMarkers ?? [];
  }, [aimMarkers]);
  useEffect(() => {
    selectedMarkerIdRef.current = selectedMarkerId;
  }, [selectedMarkerId]);
  useEffect(() => {
    repositionMarkerIdRef.current = repositionMarkerId;
  }, [repositionMarkerId]);

  useEffect(() => {
    setShowFpsOverlay(showFps);
  }, [showFps]);

  useEffect(() => {
    showFpsRef.current = showFpsOverlay;
    fpsFrameCountRef.current = 0;
    fpsSampleStartedAtRef.current = 0;
    fpsSmoothedRef.current = null;
    if (!showFpsOverlay) {
      setFps(null);
      setFpsSamples([]);
    }
  }, [showFpsOverlay]);

  const menuVisible = menuPinned || (!menuHoverSuppressed && (menuHovered || gearFocused));
  const menuClusterVisible =
    controlsVisible || menuHovered || gearFocused || menuPinned || menuHoverSuppressed;
  menuVisibleRef.current = menuVisible;

  function cancelMenuClose() {
    if (menuCloseTimer.current) {
      clearTimeout(menuCloseTimer.current);
      menuCloseTimer.current = null;
    }
  }

  function scheduleMenuClose() {
    cancelMenuClose();
    // Brief grace period so a momentary slip off the gear cluster does not
    // collapse the dropdown. The menu lives inside the cluster, so moving
    // between the gear and the items does not trigger this leave at all.
    menuCloseTimer.current = setTimeout(() => {
      setMenuHovered(false);
      setMenuHoverSuppressed(false);
    }, 100);
  }

  function closeCameraMenu() {
    cancelMenuClose();
    setMenuPinned(false);
    setGearFocused(false);
    setMenuHovered(false);
    setMenuHoverSuppressed(true);
  }

  function handleCameraMenuToggle() {
    const wasVisible = menuVisibleBeforePressRef.current ?? menuVisibleRef.current;
    menuVisibleBeforePressRef.current = null;
    if (wasVisible) {
      closeCameraMenu();
      return;
    }
    cancelMenuClose();
    setMenuHoverSuppressed(false);
    setMenuPinned(true);
    setGearFocused(true);
  }

  // Collapse the controls on Esc or an outside tap, so a touch reveal does not
  // linger after the user moves away (hover reveals close via the leave timer).
  useEffect(() => {
    if (!gearFocused && !menuPinned) return;
    function onPointerDown(event: PointerEvent) {
      if (gearClusterRef.current && !gearClusterRef.current.contains(event.target as Node)) {
        setGearFocused(false);
        setMenuPinned(false);
        setMenuHoverSuppressed(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setGearFocused(false);
        setMenuPinned(false);
        setMenuHoverSuppressed(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [gearFocused, menuPinned]);

  useEffect(() => () => cancelMenuClose(), []);

  const positionsKey = useMemo(
    () => launchPositions.map((p) => `${p.x},${p.y},${p.z}`).join('|'),
    [launchPositions],
  );
  const trailWidthGuideKey = trailWidthGuideDesign
    ? [
        trailWidthGuideDesign.burstTrail.enabled ? 'on' : 'off',
        trailWidthGuideDesign.burstTrail.particlesPerStar,
        trailWidthGuideDesign.geometry,
        trailWidthGuideDesign.pattern,
        trailWidthGuideDesign.size,
        trailWidthGuideDesign.burst.speed.join(','),
        trailWidthGuideDesign.burst.life.join(','),
        trailWidthGuideDesign.burstTrail.width.front,
        trailWidthGuideDesign.burstTrail.width.tail,
        trailWidthGuideDesign.burstTrail.width.curve,
      ].join('|')
    : 'none';

  useEffect(() => {
    showViewHelperRef.current = showViewHelper;
    forceRenderRef.current = true;
  }, [showViewHelper]);

  useEffect(() => {
    if (!playbackRef) internalElapsedRef.current = elapsed;
  }, [elapsed, playbackRef]);

  function renderFor(milliseconds: number) {
    interactionRenderUntilRef.current = performance.now() + milliseconds;
    forceRenderRef.current = true;
  }

  function sampleFps(now: number) {
    if (!showFpsRef.current) return;
    if (fpsSampleStartedAtRef.current === 0) fpsSampleStartedAtRef.current = now;
    fpsFrameCountRef.current += 1;
    const elapsedMs = now - fpsSampleStartedAtRef.current;
    if (elapsedMs < FPS_SAMPLE_WINDOW_MS) return;

    const measuredFps = Math.round((fpsFrameCountRef.current * 1000) / elapsedMs);
    const previousSmoothedFps = fpsSmoothedRef.current;
    const smoothedFps =
      previousSmoothedFps == null
        ? measuredFps
        : previousSmoothedFps + (measuredFps - previousSmoothedFps) * FPS_SMOOTHING_FACTOR;
    fpsSmoothedRef.current = smoothedFps;
    const nextFps = Math.round(smoothedFps);
    setFps((current) => (current === nextFps ? current : nextFps));
    setFpsSamples((samples) => [...samples.slice(-(FPS_HISTORY_SIZE - 1)), nextFps]);
    fpsFrameCountRef.current = 0;
    fpsSampleStartedAtRef.current = now;
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    // Deep night backdrop; the World adds a gradient dome that is black at
    // the horizon and rises into dark navy, so the floor melts into the
    // distance instead of meeting the sky at a visible edge.
    scene.background = new THREE.Color(0x020409);
    scene.fog = new THREE.FogExp2(0x05070f, 0.00012);
    sceneRef.current = scene;

    // Near plane of 2 (not 0.1): with a 100k far plane, a tiny near plane
    // leaves almost no depth precision at distance and the overlapping
    // ground planes z-fight into flickering black bars.
    const camera = new THREE.PerspectiveCamera(58, width / height, 2, 100000);
    camera.position.copy(DEFAULT_CAMERA_POSITION);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer,
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.sortObjects = false;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls calls releasePointerCapture on pointer-up for a pointer it
    // may no longer hold (e.g. after a pointercancel), which throws "Invalid
    // pointer id". Guard the canvas method so the release is a no-op unless the
    // capture is actually held.
    const domEl = renderer.domElement;
    const nativeReleasePointerCapture = domEl.releasePointerCapture.bind(domEl);
    domEl.releasePointerCapture = (pointerId: number) => {
      if (domEl.hasPointerCapture(pointerId)) nativeReleasePointerCapture(pointerId);
    };

    const renderPass = new RenderPass(scene, camera);
    // Small card canvases render the bloom pass at thumbnail resolution, which
    // reads as a soft mush when the browser upscales it. Ease the strength back
    // for sub-400px viewports so hover previews keep readable star heads.
    const bloomStrength = width < 400 ? BLOOM_STRENGTH * 0.6 : BLOOM_STRENGTH;
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      bloomStrength,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(DEFAULT_CAMERA_TARGET);
    controls.enableDamping = false;
    controls.enablePan = true;
    controls.enableZoom = allowWheelZoom;
    controls.screenSpacePanning = true;
    controls.minDistance = MIN_CAMERA_DISTANCE;
    controls.maxDistance = MAX_CAMERA_DISTANCE;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + ORBIT_FLOOR_OVERSHOOT;
    controls.enabled = interactive;
    controls.update();
    controlsRef.current = controls;
    function onControlsStart() {
      renderFor(900);
    }
    function onControlsChange() {
      renderFor(360);
    }
    function onControlsEnd() {
      renderFor(240);
    }
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', onControlsChange);
    controls.addEventListener('end', onControlsEnd);

    const engine = new FireworksEngine(scene, launchPositions, renderer, sceneMode, {
      showStarfield,
    });
    engine.attachListenerToCamera(camera);
    engine.setMuted(muted);
    engine.setSceneMode(sceneMode);
    engine.setRenderTuning({ glowPadding, whiteCoreSizePercent, whiteCoreBlurPercent });
    engine.setHeadStyle({
      coreSoftness,
      coreBrightness,
      coreOpacityFalloff,
      glowSize,
      glowSoftness,
      glowOpacityFalloff,
      glowBlur,
      backgroundGlowOpacityFalloff,
      backgroundGlowSoftness,
    });
    engineRef.current = engine;
    // A fresh engine has no cues yet; clear the applied-signature guard so the
    // cues effect re-applies them even if this is a remount with the same set.
    appliedCuesSignatureRef.current = '';
    appliedLaunchPositionsSignatureRef.current = '';
    function unlockAudio() {
      engine.resumeAudio();
    }
    document.addEventListener('pointerdown', unlockAudio, { capture: true });
    document.addEventListener('keydown', unlockAudio, { capture: true });
    const drawingBufferSize = new THREE.Vector2();
    function syncEngineViewport() {
      renderer.getDrawingBufferSize(drawingBufferSize);
      engine.setViewport(drawingBufferSize.x, drawingBufferSize.y);
    }
    syncEngineViewport();
    composer.render(0);
    let capturedElapsed = 0;
    let capturedFrame = 0;
    const captureCanvas = document.createElement('canvas');
    const captureContext = captureCanvas.getContext('2d', { willReadFrequently: true });
    if (captureContext) {
      onCaptureControllerRef.current?.({
        reset() {
          internalElapsedRef.current = 0;
          if (playbackRef) playbackRef.current = 0;
          engine.setElapsed(0);
          engine.settleCurrentBoundary();
          capturedElapsed = 0;
          capturedFrame = 0;
          composer.render(0);
        },
        captureAt(requestedElapsed, options) {
          if (!Number.isFinite(requestedElapsed) || requestedElapsed < 0) {
            throw new Error('Capture time must be a finite non-negative number.');
          }
          const target = quantiseFireworksEngineTimeSeconds(requestedElapsed);
          const targetFrame = Math.round(target / FIREWORKS_ENGINE_FIXED_STEP_SECONDS);
          if (target + 0.0001 < capturedElapsed) {
            engine.setElapsed(0);
            engine.settleCurrentBoundary();
            capturedElapsed = 0;
            capturedFrame = 0;
          }
          // Integer frame chunks keep the engine on one global 60 Hz lattice.
          // Requested sample boundaries must never introduce a fractional
          // physics step, because that changes the carrier's apex timing.
          while (capturedFrame < targetFrame) {
            const nextFrame = Math.min(targetFrame, capturedFrame + 15);
            const next = nextFrame * FIREWORKS_ENGINE_FIXED_STEP_SECONDS;
            engine.setElapsed(next);
            capturedElapsed = next;
            capturedFrame = nextFrame;
          }
          internalElapsedRef.current = target;
          if (playbackRef) playbackRef.current = target;
          composer.render(0);

          const width = renderer.domElement.width;
          const height = renderer.domElement.height;
          captureCanvas.width = width;
          captureCanvas.height = height;
          captureContext.drawImage(renderer.domElement, 0, 0, width, height);
          const pixels = captureContext.getImageData(0, 0, width, height).data;
          return {
            elapsedSeconds: target,
            width,
            height,
            pixels,
            pngBase64:
              options?.includePng === true
                ? (captureCanvas.toDataURL('image/png').split(',', 2)[1] ?? '')
                : null,
            stats: engine.getStats(),
          };
        },
      });
    }
    // The empty scene is on screen; let the parent drop its placeholder so the
    // user can see (and orbit) the stage while fireworks are still priming.
    if (!hasReportedSceneReadyRef.current) {
      hasReportedSceneReadyRef.current = true;
      onSceneReadyRef.current?.();
    }
    // Signal that scene/camera/controls refs are live so the aim-overlay and
    // picking effects (below) can safely attach.
    setSceneReady(true);

    const viewHelper = new ViewHelper(camera, renderer.domElement);
    // Keep the axis helper below the camera settings button when enabled.
    viewHelper.location.top = 64;
    viewHelper.location.right = 12;
    // Orbit around the firework focal point rather than world origin so the
    // snap-to-axis views keep the burst centred.
    viewHelper.center = controls.target;
    viewHelper.setLabels('X', 'Y', 'Z');
    const timer = new THREE.Timer();
    timer.connect(document);

    function onPointerUp(event: PointerEvent) {
      if (!controls.enabled) return;
      if (showViewHelperRef.current && viewHelper.handleClick(event)) forceRenderRef.current = true;
    }
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    let renderedElapsed = Number.NaN;
    let lastEngineUpdate = 0;
    function loop(timestamp?: number) {
      const eng = engineRef.current;
      const cam = cameraRef.current;
      const rend = rendererRef.current;
      const comp = composerRef.current;
      const sc = sceneRef.current;
      if (!eng || !cam || !rend || !comp || !sc) return;
      const now = performance.now();
      sampleFps(now);
      let timelineChanged = false;
      if (eng.isPriming()) {
        // Async prime: advance a budgeted slice, keep rendering the empty scene,
        // and report progress so the parent's loading bar can animate. The
        // playhead is not driven until priming finishes.
        const { progress, done } = eng.stepPriming(PRIME_BUDGET_MS);
        if (done) {
          const target = Math.max(
            0,
            playbackRef ? playbackRef.current : internalElapsedRef.current,
          );
          eng.setElapsed(0);
          if (target > 0) eng.setElapsed(target);
          renderedElapsed = Number.NaN;
          onPrimeProgressRef.current?.(null);
          lastReportedPrimeProgressRef.current = 0;
          setLoadingProgress(null);
          setLoadingBarVisible(false);
          if (!hasReportedReadyRef.current) {
            hasReportedReadyRef.current = true;
            onReadyRef.current?.();
          }
          // Store the finished snapshot cache so a quick back-and-forth to this
          // show skips the prime on the next mount.
          const cacheKey = primeCacheKeyRef.current;
          if (cacheKey) {
            const exported = eng.exportSnapshotCache();
            if (exported) rememberSnapshotCache(cacheKey, exported);
          }
        } else if (progress - lastReportedPrimeProgressRef.current >= 0.02) {
          lastReportedPrimeProgressRef.current = progress;
          onPrimeProgressRef.current?.(progress);
          setLoadingProgress(progress);
        }
        forceRenderRef.current = true;
      } else if (eng.isRepairing()) {
        // Post-drag accurate repair: advance a budgeted slice per frame while
        // the last-rendered frame stays on screen, so releasing the scrubber
        // never blocks orbiting or the transport. The repair chases the live
        // playhead, so pressing play mid-repair lands it exactly at the
        // current time with no follow-up catch-up seek; the NaN reset then
        // just re-syncs the loop's notion of where the engine is.
        const repairTarget = Math.max(
          0,
          playbackRef ? playbackRef.current : internalElapsedRef.current,
        );
        if (eng.stepRepair(REPAIR_BUDGET_MS, repairTarget).done) {
          renderedElapsed = Number.NaN;
          lastEngineUpdate = now;
          forceRenderRef.current = true;
        }
      } else {
        const targetElapsed = Math.max(
          0,
          playbackRef ? playbackRef.current : internalElapsedRef.current,
        );
        const delta = Math.abs(targetElapsed - renderedElapsed);
        timelineChanged = Number.isNaN(renderedElapsed) || delta > 0.0001;
        // Small forward deltas (normal playback) flow through every frame.
        // Seeks — large forward jumps and any backward move — are scrub-style
        // and every one costs a snapshot restore plus a resimulated advance, so
        // coalesce them to ~22Hz. Rapid drag events collapse to one seek per
        // window while the thumb still reads as continuous; the engine always
        // catches up to the latest playhead on the next window.
        const isLargeJump = delta > 0.15 && !Number.isNaN(renderedElapsed);
        const isBackwardSeek =
          !Number.isNaN(renderedElapsed) && targetElapsed < renderedElapsed - 0.0001;
        const isSeek = isLargeJump || isBackwardSeek;
        const engineMayUpdate = !isSeek || now - lastEngineUpdate >= 45;
        if (timelineChanged && engineMayUpdate) {
          eng.setElapsed(targetElapsed);
          renderedElapsed = targetElapsed;
          lastEngineUpdate = now;
        }
      }
      timer.update(timestamp);
      const dt = timer.getDelta();
      if (showViewHelperRef.current && viewHelper.animating) {
        viewHelper.update(dt);
        forceRenderRef.current = true;
      }
      // Floor pan. Undo last frame's lift so OrbitControls solves the orbit from
      // the true pivot (camera + target shift together, so the angle is intact),
      // run the controls, then re-lift by whatever shortfall keeps the camera
      // off the floor. The lift is a pure function of the current angle, so
      // orbiting back up unwinds it: "go a bit more" on the way down, "go out of
      // the pan" on the way back.
      if (floorLiftRef.current !== 0) liftCameraRig(cam, controls, -floorLiftRef.current);
      const controlsChanged = controls.enabled ? controls.update() : false;
      let floorLift = 0;
      if (controls.target.y < GROUND_PLANE_Y) floorLift += GROUND_PLANE_Y - controls.target.y;
      if (cam.position.y + floorLift < MIN_CAMERA_HEIGHT) {
        floorLift += MIN_CAMERA_HEIGHT - (cam.position.y + floorLift);
      }
      if (floorLift !== 0) liftCameraRig(cam, controls, floorLift);
      const floorLiftChanged = Math.abs(floorLift - floorLiftRef.current) > 1e-4;
      floorLiftRef.current = floorLift;
      const interactionActive = now < interactionRenderUntilRef.current;
      if (
        timelineChanged ||
        controlsChanged ||
        floorLiftChanged ||
        forceRenderRef.current ||
        interactionActive
      ) {
        forceRenderRef.current = false;
        orientAimMarkerBillboards(aimMarkersGroupRef.current, cam);
        comp.render(dt);
        if (showViewHelperRef.current) {
          // Gizmo overlays the main pass; it manages its own viewport region.
          rend.autoClear = false;
          viewHelper.render(rend);
          rend.autoClear = true;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    function onResize() {
      const w = container?.clientWidth || 800;
      const h = container?.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      syncEngineViewport();
      forceRenderRef.current = true;
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      onCaptureControllerRef.current?.(null);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointerdown', unlockAudio, { capture: true });
      document.removeEventListener('keydown', unlockAudio, { capture: true });
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (trailWidthGuideRef.current) {
        scene.remove(trailWidthGuideRef.current);
        disposeTrailWidthGuide(trailWidthGuideRef.current);
        trailWidthGuideRef.current = null;
      }
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', onControlsChange);
      controls.removeEventListener('end', onControlsEnd);
      timer.dispose();
      viewHelper.dispose();
      controls.dispose();
      engine.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      engineRef.current = null;
      controlsRef.current = null;
      composerRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      setSceneReady(false);
    };
    // launchPositions handled by separate effect to avoid full teardown on edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enableZoom = allowWheelZoom;
  }, [allowWheelZoom]);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = interactive;
  }, [interactive]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const targetElapsed = playbackRef ? playbackRef.current : internalElapsedRef.current;
    const cacheKey = replaySimulationCacheKey(cues, launchPositions);
    // Re-renders can re-fire this effect with content-identical cues (array
    // identity churn from parent state like play/pause). Re-applying would
    // clear() the live particles and re-seek — a visible blink — so skip when
    // nothing that affects the simulated show has actually changed.
    const applySignature = `${cacheKey}#${primeSnapshots}#${primeOnCueChanges}#${cuesFinal}`;
    if (appliedCuesSignatureRef.current === applySignature) return;
    appliedCuesSignatureRef.current = applySignature;
    if (appliedLaunchPositionsSignatureRef.current !== positionsKey) {
      engine.setLaunchPositions(launchPositions);
      appliedLaunchPositionsSignatureRef.current = positionsKey;
    }
    // Reuse a previously primed snapshot cache for this exact cue set so a
    // quick leave-and-return skips the silent full-show prime (and the loading
    // bar) instead of re-running it on every mount.
    const cached = primeSnapshots ? (snapshotCacheByKey.get(cacheKey) ?? null) : null;
    // Time-slice the initial prime so the empty scene paints and the loading
    // bar can animate while fireworks load. Once the first prime is done (or a
    // non-priming caller has settled), fall back to the synchronous path so
    // mid-session cue edits snap back to the playhead without a reload bar.
    const useAsyncPrime = primeSnapshots && !hasReportedReadyRef.current && !cached;
    // Re-prime on cue changes so seeks stay fast after edits, unless the caller
    // is a single-firework editor that rebuilds its cue on every slider tick:
    // those prime once on mount (above) then skip the per-edit prime to avoid
    // drag jank, accepting from-zero seeks after each edit.
    const shouldPrime = primeSnapshots && (useAsyncPrime || primeOnCueChanges);
    engine.clear();
    engine.setCues(cues, { prime: shouldPrime, primeAsync: useAsyncPrime, cache: cached });
    if (engine.isPriming()) {
      // The RAF loop drives `stepPriming`, seeks to the playhead, fires
      // `onReady` when priming completes, and stores the finished snapshot
      // cache. Surface 0% immediately so the bar does not sit empty for a frame.
      primeCacheKeyRef.current = cacheKey;
      lastReportedPrimeProgressRef.current = 0;
      onPrimeProgressRef.current?.(0);
      setLoadingBarVisible(true);
      setLoadingProgress(0);
      forceRenderRef.current = true;
      return;
    }
    engine.setElapsed(0);
    if (targetElapsed > 0) engine.setElapsed(targetElapsed);
    composerRef.current?.render(0);
    if (cuesFinalRef.current) {
      // For streaming callers this only flips true once the real cue set has
      // landed, so `onReady` does not fire on the initial empty scene.
      if (!hasReportedReadyRef.current) hasReportedReadyRef.current = true;
      onReadyRef.current?.();
      onPrimeProgressRef.current?.(null);
      setLoadingBarVisible(false);
    } else {
      // Cues still streaming: show the indeterminate "Preparing preview" bar
      // until the final set lands and primes.
      setLoadingBarVisible(true);
      setLoadingProgress(null);
    }
    // Persist the primed cache (or re-affirm an imported one) so the next mount
    // for this cue set can skip the prime. The async-prime path stores it from
    // the RAF completion handler instead, so only export here when not priming.
    if (shouldPrime && cacheKey) {
      const exported = engine.exportSnapshotCache();
      if (exported) rememberSnapshotCache(cacheKey, exported);
    }
    forceRenderRef.current = true;
  }, [
    cues,
    playbackRef,
    primeSnapshots,
    primeOnCueChanges,
    cuesFinal,
    launchPositions,
    positionsKey,
  ]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const guide = trailWidthGuideDesign
      ? createTrailWidthGuide(
          trailWidthGuideDesign,
          playbackRef?.current ?? elapsed,
          cues,
          launchPositions,
        )
      : null;
    if (trailWidthGuideRef.current) {
      scene.remove(trailWidthGuideRef.current);
      disposeTrailWidthGuide(trailWidthGuideRef.current);
      trailWidthGuideRef.current = null;
    }
    if (guide) {
      scene.add(guide);
      trailWidthGuideRef.current = guide;
    }
    forceRenderRef.current = true;

    return () => {
      if (!guide || trailWidthGuideRef.current !== guide) return;
      scene.remove(guide);
      disposeTrailWidthGuide(guide);
      trailWidthGuideRef.current = null;
      forceRenderRef.current = true;
    };
  }, [cues, elapsed, launchPositions, playbackRef, trailWidthGuideDesign, trailWidthGuideKey]);

  // Aim-marker overlay: rebuild the in-scene markers whenever the shot set or
  // the selection changes. Gated behind `aimMarkers` so non-editor consumers
  // never pay for this. `aimMarkersKey` is the value surrogate for the array.
  const aimMarkersKey = aimMarkers ? aimMarkersSignature(aimMarkers) : null;
  useEffect(() => {
    if (!sceneReady) return;
    const scene = sceneRef.current;
    if (!scene) return;
    if (aimMarkersGroupRef.current) {
      scene.remove(aimMarkersGroupRef.current);
      disposeTrailWidthGuide(aimMarkersGroupRef.current);
      aimMarkersGroupRef.current = null;
    }
    const markers = aimMarkers ?? [];
    if (markers.length > 0) {
      const group = buildAimMarkerGroup(markers, selectedMarkerId);
      scene.add(group);
      aimMarkersGroupRef.current = group;
    }
    forceRenderRef.current = true;
    return () => {
      if (aimMarkersGroupRef.current) {
        scene.remove(aimMarkersGroupRef.current);
        disposeTrailWidthGuide(aimMarkersGroupRef.current);
        aimMarkersGroupRef.current = null;
        forceRenderRef.current = true;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, aimMarkersKey, selectedMarkerId]);

  // Keep orbit disabled while a marker is being repositioned so dragging aims
  // the shot rather than moving the camera.
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = interactive && !repositionMarkerId;
  }, [interactive, repositionMarkerId, sceneReady]);

  // Pointer picking + drag-to-reposition. Attached once the scene is live and
  // only when the caller opted into aim markers. Latest props are read through
  // refs so this listener does not need to re-attach on every edit.
  const aimEnabled = Boolean(aimMarkers);
  useEffect(() => {
    if (!sceneReady || !aimEnabled) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    const dom = renderer.domElement;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function toNdc(event: PointerEvent) {
      const rect = dom.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickMarkerId(): string | null {
      const cam = cameraRef.current;
      const group = aimMarkersGroupRef.current;
      if (!cam || !group) return null;
      raycaster.setFromCamera(pointer, cam);
      const hits = raycaster.intersectObjects(group.children, false);
      for (const hit of hits) {
        const id = (hit.object.userData?.aimMarkerId as string | undefined) ?? null;
        if (id) return id;
      }
      return null;
    }

    let dragging = false;
    let dragId: string | null = null;
    let startX = 0;
    let startY = 0;
    let startPan = 0;
    let startTilt = 0;
    let pickCandidate: string | null = null;
    let downX = 0;
    let downY = 0;

    function computeAim(event: PointerEvent) {
      const pan = clampPan(startPan + (event.clientX - startX) * AIM_REPOSITION_PAN_PER_PX);
      const tilt = clampTilt(startTilt - (event.clientY - startY) * AIM_REPOSITION_TILT_PER_PX);
      return { pan: Math.round(pan), tilt: Math.round(tilt) };
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      toNdc(event);
      downX = event.clientX;
      downY = event.clientY;
      const repoId = repositionMarkerIdRef.current;
      if (repoId) {
        const marker = aimMarkersRef.current.find((m) => m.id === repoId);
        if (marker) {
          dragging = true;
          dragId = repoId;
          startX = event.clientX;
          startY = event.clientY;
          startPan = marker.panDegrees;
          startTilt = marker.tiltDegrees;
          if (dom.setPointerCapture) dom.setPointerCapture(event.pointerId);
          return;
        }
      }
      // Not repositioning: remember what was under the cursor. A pure click
      // (little movement) selects it; a drag falls through to orbit.
      pickCandidate = pickMarkerId();
    }

    function onPointerMove(event: PointerEvent) {
      if (!dragging || !dragId) return;
      const { pan, tilt } = computeAim(event);
      onRepositionMarkerRef.current?.(dragId, pan, tilt);
    }

    function onPointerUp(event: PointerEvent) {
      if (dragging && dragId) {
        const { pan, tilt } = computeAim(event);
        onRepositionCommitRef.current?.(dragId, pan, tilt);
        dragging = false;
        dragId = null;
        if (dom.releasePointerCapture) {
          try {
            dom.releasePointerCapture(event.pointerId);
          } catch {
            // capture may already be gone; ignore
          }
        }
        return;
      }
      const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
      if (moved <= AIM_CLICK_SLOP_PX) onSelectMarkerRef.current?.(pickCandidate);
      pickCandidate = null;
    }

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
    };
  }, [sceneReady, aimEnabled]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMuted(muted);
    // Every player drives `muted` from its play state, so muting doubles as
    // the pause signal: suspend the effect-audio context so in-flight booms
    // and crackles cut off with the timeline and resume from where they
    // stopped on play.
    engine.setPlaybackPaused(muted);
    if (!muted) engine.resumeAudio();
  }, [muted]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!scrubbing && playbackRef && !engine.isPriming()) {
      // Apply the final drag position before leaving scrub mode, so the
      // accurate repair re-seek (inside setScrubbing) runs at the released
      // playhead rather than the last coalesced one.
      engine.setElapsed(Math.max(0, playbackRef.current));
    }
    engine.setScrubbing(scrubbing);
    forceRenderRef.current = true;
  }, [scrubbing, playbackRef]);

  useEffect(() => {
    engineRef.current?.setSceneMode(sceneMode);
    const scene = sceneRef.current;
    if (scene) {
      if (sceneMode === 'day') {
        scene.background = new THREE.Color(0x0a3a86);
        scene.fog = null;
      } else {
        scene.background = new THREE.Color(0x020409);
        scene.fog = new THREE.FogExp2(0x05070f, 0.00012);
      }
    }
    renderFor(360);
  }, [sceneMode]);

  useEffect(() => {
    engineRef.current?.setRenderTuning({ glowPadding, whiteCoreSizePercent, whiteCoreBlurPercent });
    forceRenderRef.current = true;
  }, [glowPadding, whiteCoreSizePercent, whiteCoreBlurPercent]);

  useEffect(() => {
    engineRef.current?.setHeadStyle({
      coreSoftness,
      coreBrightness,
      coreOpacityFalloff,
      glowSize,
      glowSoftness,
      glowOpacityFalloff,
      glowBlur,
      backgroundGlowOpacityFalloff,
      backgroundGlowSoftness,
    });
    forceRenderRef.current = true;
  }, [
    coreSoftness,
    coreBrightness,
    coreOpacityFalloff,
    glowSize,
    glowSoftness,
    glowOpacityFalloff,
    glowBlur,
    backgroundGlowOpacityFalloff,
    backgroundGlowSoftness,
  ]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.enabled = interactive;
  }, [interactive]);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    // Orbit mode: left orbits/swivels, right pans the centre point.
    // Pan ("Hand") mode: left pans, right swivels.
    ctrl.mouseButtons = {
      LEFT: panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: panMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
    };
    forceRenderRef.current = true;
  }, [panMode]);

  function adjustZoom(factor: number) {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    const offset = cam.position.clone().sub(ctrl.target).multiplyScalar(factor);
    const dist = offset.length();
    if (dist < ctrl.minDistance) offset.setLength(ctrl.minDistance);
    else if (dist > ctrl.maxDistance) offset.setLength(ctrl.maxDistance);
    cam.position.copy(ctrl.target).add(offset);
    ctrl.update();
    renderFor(360);
  }

  function resetView() {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    cam.position.copy(DEFAULT_CAMERA_POSITION);
    ctrl.target.copy(DEFAULT_CAMERA_TARGET);
    floorLiftRef.current = 0;
    ctrl.update();
    renderFor(360);
  }

  const renderOverscan = Math.max(0, renderOverscanPx);
  const renderSurfaceLeft = renderOverscan > 0 ? -renderOverscan / 2 : 0;
  const renderSurfaceWidth = renderOverscan > 0 ? `calc(100% + ${renderOverscan}px)` : '100%';

  return (
    <>
      <div
        ref={containerRef}
        className="absolute top-0 bottom-0 h-full bg-black"
        style={{ left: renderSurfaceLeft, width: renderSurfaceWidth }}
      />
      {showFpsOverlay ? (
        <FpsGraph fps={fps} samples={fpsSamples} onClose={() => setShowFpsOverlay(false)} />
      ) : null}
      {interactive ? (
        <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-1.5">
          {allowFullscreen && onToggleFullscreen ? (
            <CanvasIconButton
              onClick={onToggleFullscreen}
              label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              active={fullscreen}
            >
              {fullscreen ? (
                <Minimize2 size={16} strokeWidth={2} />
              ) : (
                <Maximize2 size={16} strokeWidth={2} />
              )}
            </CanvasIconButton>
          ) : null}

          {showCameraControls ? (
            <div
              ref={gearClusterRef}
              className={cn(
                'flex flex-col items-end gap-1.5 transition-opacity duration-200',
                menuClusterVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
              onMouseEnter={() => {
                cancelMenuClose();
                setMenuHoverSuppressed(false);
                setMenuHovered(true);
              }}
              onMouseLeave={() => scheduleMenuClose()}
              onFocus={() => {
                setMenuHoverSuppressed(false);
                setGearFocused(true);
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setGearFocused(false);
                  setMenuPinned(false);
                  setMenuHoverSuppressed(false);
                }
              }}
            >
              <CanvasIconButton
                onPointerDown={() => {
                  menuVisibleBeforePressRef.current = menuVisibleRef.current;
                }}
                onClick={handleCameraMenuToggle}
                label={menuVisible ? 'Hide camera controls' : 'Show camera controls'}
                active={menuVisible}
              >
                <Settings size={16} strokeWidth={2} />
              </CanvasIconButton>
              <div
                aria-hidden={!menuVisible}
                inert={!menuVisible}
                className={cn(
                  'grid origin-top-right overflow-hidden transition-[max-height,opacity] ease-out will-change-[max-height,opacity] motion-reduce:transition-opacity',
                  menuVisible
                    ? 'max-h-[18.5rem] opacity-100'
                    : 'pointer-events-none max-h-0 opacity-0',
                )}
                style={{ transitionDuration: `${CAMERA_MENU_ANIMATION_MS}ms` }}
              >
                <div
                  className={cn(
                    'flex flex-col items-end gap-1.5 pt-1.5 transition-transform ease-out will-change-transform motion-reduce:transform-none',
                    menuVisible ? 'translate-y-0' : '-translate-y-2',
                  )}
                  style={{ transitionDuration: `${CAMERA_MENU_ANIMATION_MS}ms` }}
                >
                  {cameraMenuActions.map((action) => (
                    <CanvasIconButton
                      key={action.id}
                      onClick={action.onClick}
                      label={action.label}
                      active={action.active}
                    >
                      {action.icon}
                    </CanvasIconButton>
                  ))}
                  <CanvasIconButton onClick={() => adjustZoom(0.85)} label="Zoom in">
                    <ZoomIn size={16} strokeWidth={2} />
                  </CanvasIconButton>
                  <CanvasIconButton onClick={() => adjustZoom(1.2)} label="Zoom out">
                    <ZoomOut size={16} strokeWidth={2} />
                  </CanvasIconButton>
                  <CanvasIconButton
                    onClick={() => setPanMode((on) => !on)}
                    label={panMode ? 'Orbit mode' : 'Pan mode'}
                    active={panMode}
                  >
                    <Hand size={16} strokeWidth={2} />
                  </CanvasIconButton>
                  <CanvasIconButton onClick={resetView} label="Reset view">
                    <RotateCcw size={16} strokeWidth={2} />
                  </CanvasIconButton>
                  <CanvasIconButton
                    onClick={() => setSceneMode((mode) => (mode === 'day' ? 'night' : 'day'))}
                    label={sceneMode === 'day' ? 'Night preview' : 'Day preview'}
                    active={sceneMode === 'day'}
                  >
                    <Sun size={16} strokeWidth={2} />
                  </CanvasIconButton>
                  <CanvasIconButton
                    onClick={() => setShowFpsOverlay((visible) => !visible)}
                    label={showFpsOverlay ? 'Hide FPS graph' : 'Show FPS graph'}
                    active={showFpsOverlay}
                  >
                    <Activity size={16} strokeWidth={2} />
                  </CanvasIconButton>
                  <CanvasIconButton
                    onClick={() => setShowViewHelper((on) => !on)}
                    label={showViewHelper ? 'Hide XYZ axes' : 'Show XYZ axes'}
                    active={showViewHelper}
                  >
                    <Axis3d size={16} strokeWidth={2} />
                  </CanvasIconButton>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {showLoadingBar && loadingBarVisible ? (
        <ReplayLoadingBar progress={loadingProgress} position={loadingBarPosition} />
      ) : null}
    </>
  );
}

function FpsGraph({
  fps,
  samples,
  onClose,
}: {
  fps: number | null;
  samples: number[];
  onClose: () => void;
}) {
  const path = useMemo(() => buildFpsGraphPath(samples, fps), [fps, samples]);
  const values = samples.length > 0 ? samples : fps == null ? [] : [fps];
  const high = values.length > 0 ? Math.round(Math.max(...values)) : null;
  const low = values.length > 0 ? Math.round(Math.min(...values)) : null;
  const latest = fps == null ? '--' : String(fps);

  return (
    <div
      data-testid="firework-fps-meter"
      className="pointer-events-none absolute top-3 left-3 z-10 w-[10.667rem] font-mono text-white/85"
      aria-label="FPS history graph"
    >
      <div className="relative grid grid-cols-[1.35rem_1fr_1.5rem] gap-1 rounded-md border border-white/20 bg-black/65 px-1.5 py-1 font-mono tabular-nums shadow-sm backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/15 hover:text-destructive pointer-events-auto absolute top-[2px] right-[2px] size-4 rounded-full bg-white/10 p-0 text-white/85 shadow-sm focus-visible:ring-white/30"
          type="button"
          aria-label="Close FPS graph"
          title="Close FPS graph"
          data-testid="firework-fps-close"
          onClick={onClose}
        >
          <X size={10} strokeWidth={2} />
        </Button>
        <div className="flex flex-col justify-between py-0.5 text-[9px] leading-none font-semibold text-white/60">
          <span>{high == null ? '--' : high}</span>
          <span>{low == null ? '--' : low}</span>
        </div>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${FPS_GRAPH_WIDTH} ${FPS_GRAPH_HEIGHT}`}
          className="h-10 w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1={FPS_GRAPH_HEIGHT * 0.5}
            x2={FPS_GRAPH_WIDTH}
            y2={FPS_GRAPH_HEIGHT * 0.5}
            className="stroke-white/15"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path}
            className="fill-none stroke-white drop-shadow-[0_0_5px_rgba(255,255,255,0.65)]"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="flex h-10 items-end justify-end pb-0.5 text-[11px] leading-none font-semibold text-white">
          {latest}
        </div>
      </div>
    </div>
  );
}

function CanvasIconButton({
  onClick,
  onPointerDown,
  label,
  active = false,
  className = '',
  children,
}: {
  onClick: () => void;
  onPointerDown?: () => void;
  label: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={onClick}
      aria-label={label}
      className={cn(
        'focus-glow-action flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-colors duration-150 ease-out focus:outline-none focus-visible:outline-none',
        active
          ? 'border-primary/40 bg-primary-container/85 text-on-primary-container'
          : 'border-outline-variant/15 bg-surface-container-low/80 text-on-surface hover:bg-surface-container-high/90',
        className,
      )}
    >
      {children}
    </button>
  );
}
