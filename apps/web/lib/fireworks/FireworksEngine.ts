/**
 * Top-level Three.js fireworks engine.
 *
 * Owns the scene, particle pool, sound handler, lighting, and the cue
 * scheduler. Mounted by {@link FireworkReplayViewer} on the client; never
 * imported on the server (uses `window`, `THREE`, and `<canvas>`).
 *
 * Lifecycle: call `start(cues)` to bind a list of replay cues to the
 * timeline, then drive `step(currentTime)` from `requestAnimationFrame` or
 * an external clock. `dispose()` must be called on unmount to free GPU
 * resources.
 */
import * as THREE from 'three';
import type { ReplayCue } from '@/lib/show-domain';
import {
  DEFAULT_LAUNCH_POSITIONS,
  type FireworkDesign,
  type FireworkStarLayer,
  type LaunchPosition,
  compileFireworkDesign,
  scaleDesignForCaliber,
  scaleDesignForEmphasis,
} from '@/lib/fireworks/design';
import { ParticlePool } from '@/lib/fireworks/ParticlePool';
import { SoundHandler } from '@/lib/fireworks/SoundHandler';
import { Lights } from '@/lib/fireworks/Lights';
import { type FireworkSceneMode, World } from '@/lib/fireworks/World';
import { Effects } from '@/lib/fireworks/Effects';
import { Scheduler } from '@/lib/fireworks/Scheduler';
import {
  FRAGMENT_SHADER,
  HEAD_BILLBOARD_FRAGMENT_SHADER,
  HEAD_BILLBOARD_VERTEX_SHADER,
  SMOKE_FRAGMENT_SHADER,
  SMOKE_VERTEX_SHADER,
  VERTEX_SHADER,
} from '@/lib/fireworks/shaders';
import { createSeededRng, mixSeed } from '@/lib/fireworks/random';
import { HIDDEN_PARTICLE_SHAPE, type Particle } from '@/lib/fireworks/Particle';
import {
  DEFAULT_FIREWORK_HEAD_STYLE,
  DEFAULT_FIREWORK_RENDER_TUNING,
  HEAD_SPRITE_MAX_SIZE,
  normaliseFireworkHeadStyle,
  normaliseFireworkRenderTuning,
  type FireworkHeadStyle,
  type FireworkRenderTuning,
} from '@/lib/fireworks/render-tuning';
import { replayCuesSimulationKey } from '@/lib/fireworks/replay-cache-key';
import { FIREWORKS_ENGINE_FIXED_STEP_SECONDS } from '@/lib/fireworks/import-renderer-contract';

export { FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION } from '@/lib/fireworks/import-renderer-contract';

export type PoolSnapshot = {
  indices: Uint32Array;
  /** packed [x,y,z,vx,vy,vz,life,size,alpha,r,g,b,mass,decay,gravity,drag,maxLife,shape,rotation,spin,fadeIn,headStyleSlot] per particle */
  data: Float32Array;
  current: number;
  aliveMax: number;
};

export type SnapshotCacheEntry = { time: number; state: PoolSnapshot; lossy: boolean };

export type HeadRenderStyle = FireworkHeadStyle & FireworkRenderTuning;
export type HeadStylePairSnapshot = { outer: HeadRenderStyle; core: HeadRenderStyle };

/**
 * Serialisable-ish snapshot of the primed seek cache, plus the simulated show
 * length it covers. The packed `Uint32Array`/`Float32Array` buffers inside each
 * entry are kept by reference: the engine never mutates them after capture
 * (`captureSnapshot` allocates fresh, `restoreSnapshot` only reads), so a
 * module-level cache can hold and re-feed them across remounts without copying
 * potentially hundreds of MB of particle state.
 */
export type SnapshotCacheData = {
  snapshots: SnapshotCacheEntry[];
  primingEnd: number;
  snapshotStride: number;
  /** Stable slot table referenced by each packed particle's headStyleSlot. */
  headStylePairs: HeadStylePairSnapshot[];
};

export type FireworksEngineStats = {
  cues: number;
  particles: number;
  scheduledEvents: number;
};

const PARTICLE_CAPACITY = 100_000;
const FIXED_DT = FIREWORKS_ENGINE_FIXED_STEP_SECONDS;
// Scrub rebuilds can be coarser than playback; procedural emitters compensate
// by ageing particles across each rebuilt segment.
const SCRUB_DT = 1 / 24;
// Coarser still while the user is actively dragging the thumb: this state is
// transient (an accurate re-seek repairs it when the drag ends), so halving
// the step count keeps fast drags across busy shows responsive.
const SCRUB_DRAG_DT = 1 / 12;
const LARGE_JUMP_SECONDS = 0.35;
const SNAPSHOT_STRIDE = 22;
// Sized for SNAPSHOT_INTERVAL below: 1200 half-second snapshots covers a
// 10-minute show before eviction starts dropping the earliest entries.
const MAX_SNAPSHOTS = 1200;
const BRIGHTNESS_BOOST = 1.55;
const MAX_COLOR_INTENSITY = 1.75;

type FireworksEngineOptions = {
  showStarfield?: boolean;
};

export class FireworksEngine {
  private scene: THREE.Scene;
  private camera: THREE.Camera | null = null;
  private pool: ParticlePool;
  private sound: SoundHandler;
  private lights: Lights;
  private world: World;
  private effects: Effects;
  private scheduler: Scheduler;

  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private points: THREE.Points;
  private headBillboardsEnabled: boolean;
  private headBillboardGeometry: THREE.InstancedBufferGeometry | null = null;
  private headBillboardMaterial: THREE.ShaderMaterial | null = null;
  private headBillboardMesh: THREE.Mesh | null = null;
  private smokeGeometry: THREE.BufferGeometry;
  private smokeMaterial: THREE.ShaderMaterial;
  private smokePoints: THREE.Points;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private shapes: Float32Array;
  private rotations: Float32Array;
  private pointHeadStyleA: Float32Array;
  private pointHeadStyleB: Float32Array;
  private pointHeadStyleC: Float32Array;
  private smokePositions: Float32Array;
  private smokeColors: Float32Array;
  private smokeSizes: Float32Array;
  private smokeOpacities: Float32Array;
  private headPositions: Float32Array | null = null;
  private headColors: Float32Array | null = null;
  private headSizes: Float32Array | null = null;
  private headShapes: Float32Array | null = null;
  private billboardHeadStyleA: Float32Array | null = null;
  private billboardHeadStyleB: Float32Array | null = null;
  private billboardHeadStyleC: Float32Array | null = null;
  private positionAttribute: THREE.BufferAttribute;
  private colorAttribute: THREE.BufferAttribute;
  private sizeAttribute: THREE.BufferAttribute;
  private shapeAttribute: THREE.BufferAttribute;
  private rotationAttribute: THREE.BufferAttribute;
  private pointHeadStyleAAttribute: THREE.BufferAttribute;
  private pointHeadStyleBAttribute: THREE.BufferAttribute;
  private pointHeadStyleCAttribute: THREE.BufferAttribute;
  private smokePositionAttribute: THREE.BufferAttribute;
  private smokeColorAttribute: THREE.BufferAttribute;
  private smokeSizeAttribute: THREE.BufferAttribute;
  private smokeOpacityAttribute: THREE.BufferAttribute;
  private headPositionAttribute: THREE.InstancedBufferAttribute | null = null;
  private headColorAttribute: THREE.InstancedBufferAttribute | null = null;
  private headSizeAttribute: THREE.InstancedBufferAttribute | null = null;
  private headShapeAttribute: THREE.InstancedBufferAttribute | null = null;
  private billboardHeadStyleAAttribute: THREE.InstancedBufferAttribute | null = null;
  private billboardHeadStyleBAttribute: THREE.InstancedBufferAttribute | null = null;
  private billboardHeadStyleCAttribute: THREE.InstancedBufferAttribute | null = null;
  private viewport = new THREE.Vector2(1, 1);

  /**
   * Cue-owned style pairs. Particles keep a stable slot into this table, so a
   * later overlapping cue cannot restyle an earlier cue's live heads.
   */
  private headStylePairs: HeadStylePairSnapshot[] = [defaultHeadStylePair()];
  /** Cue slots start at one, leaving mutable preview defaults isolated at slot zero. */
  private headStylePairSlots = new Map<string, number>();

  private elapsed = 0;
  private time = 0;
  /** Snapshots keyed by elapsed seconds, used for fast backward seeks. */
  private snapshots: { time: number; state: PoolSnapshot; lossy: boolean }[] = [];
  // Half-second stride: every seek resimulates at most this much show time to
  // catch up from the restored snapshot, so a denser cache directly buys a
  // snappier timeline (at ~2x the cache memory of the old 1s stride).
  private readonly SNAPSHOT_INTERVAL = 0.5;
  // When the nearest snapshot to a seek is lossy (captured while callback-driven
  // heads/flashes were alive), prefer a nearby accurate snapshot if one sits
  // within this window. Keeps restores faithful when cheap, without falling back
  // to the from-zero rebuilds that froze scrubbing on busy shows.
  private readonly PREFER_CLEAN_SNAPSHOT_WINDOW = 1.5;
  // Async post-drag repair state: when active, `stepRepair` resimulates from
  // the nearest clean snapshot to the release playhead in budgeted slices,
  // with geometry sync suppressed so the last (lossy) frame stays on screen
  // until the accurate state lands. Never trades accuracy away: lossy
  // restores are display-only transients during the drag itself.
  private repairActive = false;
  private repairTarget = 0;
  // Whether the last snapshot captured during priming was lossy, so the prime
  // can plant an extra clean capture at the end of each lossy stretch.
  private lastPrimeCaptureLossy = false;
  private nextSnapshotAt = 0;
  private primed = false;
  private cueSignature = '';
  // Async priming state: when active, `stepPriming` drives the silent full-show
  // pass across frames so the main thread stays responsive while fireworks load.
  private primingActive = false;
  private primingCursor = 0;
  private primingEnd = 0;
  // Scrub mode: while the user drags the timeline, seeks trade fidelity for
  // speed (lossy snapshot restores are accepted instead of falling back to a
  // from-zero rebuild). When the drag ends, an accurate re-seek repairs any
  // lossy state so playback resumes with correct behaviour callbacks.
  private scrubbing = false;
  private needsAccurateReseek = false;

  constructor(
    scene: THREE.Scene,
    launchPositions: LaunchPosition[] = DEFAULT_LAUNCH_POSITIONS,
    renderer?: THREE.WebGLRenderer,
    sceneMode: FireworkSceneMode = 'night',
    options: FireworksEngineOptions = {},
  ) {
    this.scene = scene;
    this.pool = new ParticlePool(PARTICLE_CAPACITY);
    this.sound = new SoundHandler();
    void this.sound.load();
    this.lights = new Lights(scene);
    this.world = new World(scene, launchPositions, sceneMode, {
      showStarfield: options.showStarfield,
    });
    this.effects = new Effects(this.pool, this.sound, this.lights);
    this.scheduler = new Scheduler();
    this.headBillboardsEnabled = readMaxPointSize(renderer) < HEAD_SPRITE_MAX_SIZE;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
    });
    this.smokeMaterial = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERTEX_SHADER,
      fragmentShader: SMOKE_FRAGMENT_SHADER,
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
    });

    this.positions = new Float32Array(PARTICLE_CAPACITY * 3);
    this.colors = new Float32Array(PARTICLE_CAPACITY * 3);
    this.sizes = new Float32Array(PARTICLE_CAPACITY);
    this.shapes = new Float32Array(PARTICLE_CAPACITY);
    this.rotations = new Float32Array(PARTICLE_CAPACITY);
    this.pointHeadStyleA = new Float32Array(PARTICLE_CAPACITY * 4);
    this.pointHeadStyleB = new Float32Array(PARTICLE_CAPACITY * 4);
    this.pointHeadStyleC = new Float32Array(PARTICLE_CAPACITY * 4);
    this.smokePositions = new Float32Array(PARTICLE_CAPACITY * 3);
    this.smokeColors = new Float32Array(PARTICLE_CAPACITY * 3);
    this.smokeSizes = new Float32Array(PARTICLE_CAPACITY);
    this.smokeOpacities = new Float32Array(PARTICLE_CAPACITY);

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.sizeAttribute = new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage);
    this.shapeAttribute = new THREE.BufferAttribute(this.shapes, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.rotationAttribute = new THREE.BufferAttribute(this.rotations, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.pointHeadStyleAAttribute = new THREE.BufferAttribute(this.pointHeadStyleA, 4).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.pointHeadStyleBAttribute = new THREE.BufferAttribute(this.pointHeadStyleB, 4).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.pointHeadStyleCAttribute = new THREE.BufferAttribute(this.pointHeadStyleC, 4).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
    this.geometry.setAttribute('size', this.sizeAttribute);
    this.geometry.setAttribute('shape', this.shapeAttribute);
    this.geometry.setAttribute('rotation', this.rotationAttribute);
    this.geometry.setAttribute('headStyleA', this.pointHeadStyleAAttribute);
    this.geometry.setAttribute('headStyleB', this.pointHeadStyleBAttribute);
    this.geometry.setAttribute('headStyleC', this.pointHeadStyleCAttribute);
    this.geometry.setDrawRange(0, 0);

    this.smokeGeometry = new THREE.BufferGeometry();
    this.smokePositionAttribute = new THREE.BufferAttribute(this.smokePositions, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.smokeColorAttribute = new THREE.BufferAttribute(this.smokeColors, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.smokeSizeAttribute = new THREE.BufferAttribute(this.smokeSizes, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.smokeOpacityAttribute = new THREE.BufferAttribute(this.smokeOpacities, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.smokeGeometry.setAttribute('position', this.smokePositionAttribute);
    this.smokeGeometry.setAttribute('color', this.smokeColorAttribute);
    this.smokeGeometry.setAttribute('size', this.smokeSizeAttribute);
    this.smokeGeometry.setAttribute('smokeOpacity', this.smokeOpacityAttribute);
    this.smokeGeometry.setDrawRange(0, 0);

    this.smokePoints = new THREE.Points(this.smokeGeometry, this.smokeMaterial);
    this.smokePoints.frustumCulled = false;
    this.smokePoints.renderOrder = 1;
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.smokePoints);
    scene.add(this.points);
    if (this.headBillboardsEnabled) this.createHeadBillboards();
  }

  private createHeadBillboards(): void {
    this.headPositions = new Float32Array(PARTICLE_CAPACITY * 3);
    this.headColors = new Float32Array(PARTICLE_CAPACITY * 3);
    this.headSizes = new Float32Array(PARTICLE_CAPACITY);
    this.headShapes = new Float32Array(PARTICLE_CAPACITY);
    this.billboardHeadStyleA = new Float32Array(PARTICLE_CAPACITY * 4);
    this.billboardHeadStyleB = new Float32Array(PARTICLE_CAPACITY * 4);
    this.billboardHeadStyleC = new Float32Array(PARTICLE_CAPACITY * 4);

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute(
      'quadCorner',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2),
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.instanceCount = 0;

    this.headPositionAttribute = new THREE.InstancedBufferAttribute(this.headPositions, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.headColorAttribute = new THREE.InstancedBufferAttribute(this.headColors, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.headSizeAttribute = new THREE.InstancedBufferAttribute(this.headSizes, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.headShapeAttribute = new THREE.InstancedBufferAttribute(this.headShapes, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.billboardHeadStyleAAttribute = new THREE.InstancedBufferAttribute(
      this.billboardHeadStyleA,
      4,
    ).setUsage(THREE.DynamicDrawUsage);
    this.billboardHeadStyleBAttribute = new THREE.InstancedBufferAttribute(
      this.billboardHeadStyleB,
      4,
    ).setUsage(THREE.DynamicDrawUsage);
    this.billboardHeadStyleCAttribute = new THREE.InstancedBufferAttribute(
      this.billboardHeadStyleC,
      4,
    ).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('instancePosition', this.headPositionAttribute);
    geometry.setAttribute('instanceColor', this.headColorAttribute);
    geometry.setAttribute('instanceSize', this.headSizeAttribute);
    geometry.setAttribute('instanceShape', this.headShapeAttribute);
    geometry.setAttribute('instanceHeadStyleA', this.billboardHeadStyleAAttribute);
    geometry.setAttribute('instanceHeadStyleB', this.billboardHeadStyleBAttribute);
    geometry.setAttribute('instanceHeadStyleC', this.billboardHeadStyleCAttribute);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        viewport: { value: this.viewport },
      },
      vertexShader: HEAD_BILLBOARD_VERTEX_SHADER,
      fragmentShader: HEAD_BILLBOARD_FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      vertexColors: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;

    this.headBillboardGeometry = geometry;
    this.headBillboardMaterial = material;
    this.headBillboardMesh = mesh;
    this.scene.add(mesh);
  }

  setRenderTuning(tuning: Partial<FireworkRenderTuning> | null | undefined): void {
    const next = normaliseFireworkRenderTuning(tuning);
    this.updateDefaultHeadStylePair((style) => ({ ...style, ...next }));
  }

  /**
   * Shape the glowing head orbs (brocade heads and star orbs): how soft the
   * coloured core reads, how hot its centre burns, and the size/softness of the
   * surrounding glow. Runtime/preview-only, like {@link setRenderTuning}.
   */
  setHeadStyle(style: Partial<FireworkHeadStyle> | null | undefined): void {
    const next = normaliseFireworkHeadStyle(style);
    this.updateDefaultHeadStylePair((current) => ({ ...current, ...next }));
  }

  setLayerHeadStyles(outer: FireworkStarLayer['head'], core: FireworkStarLayer['head']): number {
    const pair = {
      outer: normaliseHeadRenderStyle(outer),
      core: normaliseHeadRenderStyle(core),
    };
    const key = headStylePairKey(pair);
    const existing = this.headStylePairSlots.get(key);
    if (existing !== undefined) return existing;

    const slot = this.headStylePairs.length;
    this.headStylePairs.push(pair);
    this.headStylePairSlots.set(key, slot);
    return slot;
  }

  private updateDefaultHeadStylePair(update: (style: HeadRenderStyle) => HeadRenderStyle): void {
    const current = this.headStylePairs[0] ?? defaultHeadStylePair();
    this.headStylePairs[0] = {
      outer: update(current.outer),
      core: update(current.core),
    };
    this.rebuildHeadStylePairSlots();
  }

  private resetHeadStylePairs(): void {
    const fallback = this.headStylePairs[0] ?? defaultHeadStylePair();
    this.headStylePairs = [cloneHeadStylePair(fallback)];
    this.rebuildHeadStylePairSlots();
  }

  private replaceHeadStylePairs(pairs: readonly HeadStylePairSnapshot[]): void {
    this.headStylePairs =
      pairs.length > 0
        ? pairs.map((pair) => ({
            outer: normaliseHeadRenderStyle(pair.outer),
            core: normaliseHeadRenderStyle(pair.core),
          }))
        : [defaultHeadStylePair()];
    this.rebuildHeadStylePairSlots();
  }

  private rebuildHeadStylePairSlots(): void {
    this.headStylePairSlots.clear();
    for (let slot = 1; slot < this.headStylePairs.length; slot++) {
      const key = headStylePairKey(this.headStylePairs[slot]);
      if (!this.headStylePairSlots.has(key)) this.headStylePairSlots.set(key, slot);
    }
  }

  private headStyleForParticle(particle: Particle): HeadRenderStyle {
    const pair = this.headStylePairs[particle.headStyleSlot] ?? this.headStylePairs[0];
    return particle.shape >= 3 ? pair.core : pair.outer;
  }

  setViewport(width: number, height: number): void {
    this.viewport.set(Math.max(1, width), Math.max(1, height));
  }

  attachListenerToCamera(camera: THREE.Camera): void {
    if (this.camera === camera) return;
    this.camera?.remove(this.sound.listener);
    this.camera = camera;
    camera.add(this.sound.listener);
  }

  setLaunchPositions(positions: LaunchPosition[]): void {
    this.world.rebuild(positions);
  }

  setSceneMode(sceneMode: FireworkSceneMode): void {
    this.world.setSceneMode(sceneMode);
  }

  setMuted(muted: boolean): void {
    this.sound.setMuted(muted);
  }

  /** Freeze/unfreeze in-flight effect sounds to match a paused timeline. */
  setPlaybackPaused(paused: boolean): void {
    this.sound.setPlaybackPaused(paused);
  }

  resumeAudio(): void {
    void this.sound.resume();
  }

  setCues(
    cues: ReplayCue[],
    options: { prime?: boolean; primeAsync?: boolean; cache?: SnapshotCacheData | null } = {},
  ): void {
    const target = this.elapsed;
    const nextCueSignature = this.createCueSignature(cues);
    const cuesChanged = nextCueSignature !== this.cueSignature;
    this.cueSignature = nextCueSignature;
    this.scheduler.setCues(cues);
    // Cancel any in-flight async prime or repair so a fresh cue set restarts
    // cleanly.
    this.primingActive = false;
    this.repairActive = false;
    this.needsAccurateReseek = false;
    if (cuesChanged) {
      this.primed = false;
      this.snapshots.length = 0;
      this.nextSnapshotAt = 0;
      this.resetHeadStylePairs();
    }
    if (options.cache && this.importSnapshotCache(options.cache)) {
      // Cached prime: skip the silent full pass and settle at the playhead.
      if (target > 0) this.seekTo(target);
      return;
    }
    if (options.prime && (cuesChanged || !this.primed) && this.beginPriming()) {
      if (options.primeAsync) {
        // The caller drives `stepPriming` each animation frame so the main
        // thread stays responsive and the scene can render while fireworks
        // load. `stepPriming` finalises (and sets `primed`) when it reaches
        // the end; the caller then seeks back to the playhead.
        return;
      }
      while (this.primingActive) this.stepPriming(Infinity);
      this.primed = true;
      if (target > 0) this.seekTo(target);
      return;
    }
    this.snapshots.length = 0;
    this.nextSnapshotAt = 0;
    this.seekTo(target);
  }

  private createCueSignature(cues: ReplayCue[]): string {
    return replayCuesSimulationKey(cues);
  }

  /**
   * Hand back the current primed snapshot cache so a caller can keep it alive
   * across remounts and skip the silent full-show pass on re-entry. Returns
   * null when nothing useful has been primed yet.
   */
  exportSnapshotCache(): SnapshotCacheData | null {
    if (this.snapshots.length === 0) return null;
    return {
      // Shallow-copy the wrapper array so later engine pushes don't mutate the
      // cached entry; the packed typed arrays inside `state` stay shared.
      snapshots: this.snapshots.map((s) => ({ time: s.time, lossy: s.lossy, state: s.state })),
      primingEnd: this.primingEnd,
      snapshotStride: SNAPSHOT_STRIDE,
      headStylePairs: this.headStylePairs.map(cloneHeadStylePair),
    };
  }

  /**
   * Load a previously exported snapshot cache, mark the engine primed, and
   * reset to t=0 so the caller can seek to the playhead. Returns false when the
   * cache is empty/missing so `setCues` falls through to a real prime.
   */
  importSnapshotCache(cache: SnapshotCacheData | null | undefined): boolean {
    if (!cache || cache.snapshotStride !== SNAPSHOT_STRIDE || cache.snapshots.length === 0) {
      return false;
    }
    this.primingActive = false;
    this.primingCursor = 0;
    this.primingEnd = cache.primingEnd;
    this.replaceHeadStylePairs(cache.headStylePairs ?? []);
    // Fresh wrapper array, shared read-only typed arrays.
    this.snapshots = cache.snapshots.map((s) => ({ time: s.time, lossy: s.lossy, state: s.state }));
    const lastTime = this.snapshots[this.snapshots.length - 1].time;
    this.nextSnapshotAt = lastTime + this.SNAPSHOT_INTERVAL;
    this.primed = true;
    this.pool.reset();
    this.lights.reset();
    this.scheduler.resetAll();
    this.elapsed = 0;
    this.time = 0;
    this.syncGeometry();
    return true;
  }

  /** True while an async prime is mid-flight (see `setCues` with `primeAsync`). */
  isPriming(): boolean {
    return this.primingActive;
  }

  /**
   * Advance the in-flight async prime by up to `budgetMs` of wall-clock work,
   * capturing a snapshot every {@link SNAPSHOT_INTERVAL} seconds. Returns the
   * 0..1 progress and whether priming is complete. When complete, the engine is
   * reset to t=0 with the snapshot cache populated and `primed` set.
   */
  stepPriming(budgetMs: number): { progress: number; done: boolean } {
    if (!this.primingActive) return { progress: 1, done: true };
    const start = performance.now();
    this.effects.setAudible(false);
    const boundaryCues = this.scheduler.pop(this.primingCursor, this.primingCursor);
    for (const cue of boundaryCues) this.fireCue(cue, false);
    while (this.primingCursor + 0.0001 < this.primingEnd) {
      const next = Math.min(this.primingEnd, this.primingCursor + SCRUB_DT);
      const due = this.scheduler.pop(this.primingCursor, next);
      this.tickPhysics(next - this.primingCursor);
      this.primingCursor = next;
      for (const cue of due) this.fireCue(cue, false);
      // Capture on the regular stride, and additionally the moment the pool
      // transitions back to callback-free after a lossy stretch. That plants a
      // clean snapshot right at the end of every burst, so accurate repairs
      // resimulate at most the overlapping burst instead of the whole gap back
      // to the last stride capture that happened to land in a quiet moment.
      const lossyNow = this.poolHasLiveCallbackParticles();
      if (this.primingCursor >= this.nextSnapshotAt || (!lossyNow && this.lastPrimeCaptureLossy)) {
        this.snapshots.push({
          time: this.primingCursor,
          state: this.captureSnapshot(),
          lossy: lossyNow,
        });
        this.lastPrimeCaptureLossy = lossyNow;
        if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift();
        this.nextSnapshotAt = this.primingCursor + this.SNAPSHOT_INTERVAL;
      }
      if (performance.now() - start >= budgetMs) break;
    }
    this.elapsed = this.primingCursor;
    if (this.primingCursor + 0.0001 >= this.primingEnd) {
      // Reset to the start, keeping the snapshots.
      this.pool.reset();
      this.lights.reset();
      this.scheduler.resetAll();
      this.elapsed = 0;
      this.time = 0;
      this.nextSnapshotAt = 0;
      this.syncGeometry();
      this.primingActive = false;
      this.primed = true;
      return { progress: 1, done: true };
    }
    return { progress: clamp(this.primingCursor / this.primingEnd, 0, 1), done: false };
  }

  /**
   * Reset to t=0 and arm a silent full-show pass that {@link stepPriming} will
   * drive across frames. Returns false when there are no cues to prime, so
   * callers can retry once cues arrive. Replaces the old synchronous
   * `primeSnapshots` so the page can paint the empty scene and a progress bar
   * while fireworks load instead of blocking the main thread.
   */
  private beginPriming(): boolean {
    if (this.scheduler.size() === 0) return false;
    const end = this.scheduler.lastCueTime() + 10;
    this.pool.reset();
    this.lights.reset();
    this.scheduler.resetAll();
    this.elapsed = 0;
    this.time = 0;
    this.snapshots.length = 0;
    // Seed an empty t=0 snapshot so a seek back to the start restores instead
    // of falling through to the from-zero rebuild, which would wipe the cache.
    this.snapshots.push({ time: 0, state: this.captureSnapshot(), lossy: false });
    this.lastPrimeCaptureLossy = false;
    this.nextSnapshotAt = this.SNAPSHOT_INTERVAL;
    this.syncGeometry();
    this.primingCursor = 0;
    this.primingEnd = end;
    this.primingActive = true;
    return true;
  }

  /**
   * Drive timeline. Scrubbing or large jumps silently rebuild the particle
   * state at the target time; normal forward playback emits sound.
   *
   * Single-firework previews (admin editors) bypass the snapshot cache on
   * seeks: snapshot restores drop behaviour callbacks, which freezes
   * callback-driven effects such as brocade heads and flips the preview
   * between lossy-restore and from-zero-rebuild frames as the thumb crosses
   * snapshot boundaries. Rebuilding from zero is cheap for one firework and
   * replays trails accurately. Multi-cue shows keep snapshot seeks so long,
   * busy timelines do not freeze on every scrub.
   */
  setElapsed(target: number): void {
    // An explicit seek supersedes any in-flight post-drag repair.
    this.repairActive = false;
    const next = Math.max(0, target);
    const delta = next - this.elapsed;
    const isBackwardSeek = delta < -0.0001;
    const useSnapshots = this.scheduler.size() > 1;
    if (isBackwardSeek) {
      this.seekTo(next, { useSnapshots });
      return;
    }
    if (delta > LARGE_JUMP_SECONDS) {
      this.seekTo(next, { useSnapshots });
      return;
    }
    if (delta <= 0.0001) return;
    this.advanceTo(next, true);
  }

  /**
   * Materialise cues at the current playhead without ageing them. Deterministic
   * capture uses this after a reset so a t=0 sample contains a fresh launch,
   * while the first physics update still belongs to the following frame.
   */
  settleCurrentBoundary(): void {
    this.effects.setAudible(false);
    const due = this.scheduler.pop(this.elapsed, this.elapsed);
    for (const cue of due) this.fireCue(cue, false);
    if (due.length > 0) this.syncGeometry();
  }

  /**
   * Toggle timeline-scrub mode. While active, seeks accept lossy snapshot
   * restores instead of falling back to a from-zero rebuild, so dragging the
   * thumb across a busy show stays responsive. Turning it off arms an accurate
   * repair to the release playhead when a lossy restore happened mid-drag, so
   * behaviour-driven effects (brocade heads, launch trails, flashes) replay
   * correctly. The repair is asynchronous: the caller's render loop drives
   * {@link stepRepair} in budgeted slices, so releasing the thumb never blocks
   * the main thread, and geometry sync stays suppressed until the accurate
   * state lands.
   */
  setScrubbing(active: boolean): void {
    if (this.scrubbing === active) return;
    this.scrubbing = active;
    if (active) {
      // Grabbing the thumb again abandons any in-flight repair; the next
      // scrub seek restores from a snapshot and supersedes it.
      this.repairActive = false;
      return;
    }
    if (!this.needsAccurateReseek) return;
    this.needsAccurateReseek = false;
    this.beginRepair(this.elapsed);
  }

  /** True while an async post-drag repair is mid-flight (see `setScrubbing`). */
  isRepairing(): boolean {
    return this.repairActive;
  }

  /**
   * Arm an accurate resimulation from the nearest clean snapshot up to
   * `target`. Restores the snapshot immediately (without syncing geometry, so
   * the on-screen frame is untouched) and leaves the catch-up to `stepRepair`.
   * Falls back to a synchronous accurate seek when no clean snapshot exists
   * (unprimed engines), whose cost is bounded by the same from-zero rebuild
   * the old path used.
   */
  private beginRepair(target: number): void {
    const clean = this.findCleanSnapshotAtOrBefore(target);
    if (!clean) {
      this.seekTo(target, { useSnapshots: this.scheduler.size() > 1 });
      return;
    }
    this.restoreSnapshot(clean.state);
    this.elapsed = clean.time;
    this.time = clean.time;
    this.scheduler.resetFiredAfter(clean.time);
    this.nextSnapshotAt = clean.time + this.SNAPSHOT_INTERVAL;
    if (clean.time + 0.0001 >= target) {
      // Snapshot lands exactly on the playhead: nothing to resimulate.
      this.syncGeometry();
      return;
    }
    this.repairTarget = target;
    this.repairActive = true;
  }

  /**
   * Advance the in-flight repair by up to `budgetMs` of wall-clock work.
   * Geometry is only synced when the repair completes, so intermediate states
   * never flash on screen; until then the last rendered (lossy) frame stays
   * up, which is visually indistinguishable at a paused playhead.
   *
   * `target` lets the caller chase a moving playhead: if the user presses
   * play while the repair is in flight, extending the target means the repair
   * lands exactly at the live playhead — without it, completion would be
   * followed by a second large (and synchronous) catch-up seek.
   */
  stepRepair(budgetMs: number, target?: number): { done: boolean } {
    if (!this.repairActive) return { done: true };
    if (target !== undefined && target > this.repairTarget) this.repairTarget = target;
    const start = performance.now();
    this.effects.setAudible(false);
    let cursor = this.elapsed;
    const boundaryCues = this.scheduler.pop(cursor, cursor);
    for (const cue of boundaryCues) this.fireCue(cue, false);
    while (cursor + 0.0001 < this.repairTarget) {
      const next = Math.min(this.repairTarget, cursor + SCRUB_DT);
      const due = this.scheduler.pop(cursor, next);
      this.tickPhysics(next - cursor);
      cursor = next;
      for (const cue of due) this.fireCue(cue, false);
      if (performance.now() - start >= budgetMs) break;
    }
    this.elapsed = cursor;
    if (cursor + 0.0001 >= this.repairTarget) {
      this.elapsed = this.repairTarget;
      this.repairActive = false;
      this.syncGeometry();
      return { done: true };
    }
    return { done: false };
  }

  /** Drop all live particles & flash lights — used at end-of-show flush. */
  clear(): void {
    this.pool.reset();
    this.lights.reset();
    this.syncGeometry();
  }

  private fireCue(cue: ReplayCue, audible: boolean): void {
    const baseDesign = scaleDesignForCaliber(
      cue.firework.renderDesign ?? compileFireworkDesign({ legacySpec: cue.firework.rawSpec }),
      cue.firework.caliber,
    );
    const design = scaleDesignForEmphasis(baseDesign, cue.emphasis);
    const headStyleSlot = this.setLayerHeadStyles(design.stars.outer.head, design.stars.core.head);
    const idx = (cue as ReplayCue & { launchPositionIndex?: number }).launchPositionIndex ?? 0;
    const basePos = this.world.getLaunchPosition(idx);
    const override = cue.shotPositionOverride;
    const pos = override
      ? {
          x: basePos.x + override.x,
          y: basePos.y + override.y,
          z: basePos.z + override.z,
        }
      : basePos;
    const seed = mixSeed(
      cue.seedOverride ?? undefined,
      cue.id,
      cue.firework.id,
      cue.timeSeconds,
      idx,
    );
    this.pool.withHeadStyleSlot(headStyleSlot, () => {
      this.effects.fire(design, pos, {
        rng: createSeededRng(seed),
        smokeRng: createSeededRng(mixSeed(seed, 'launch-smoke')),
        liftRng: createSeededRng(mixSeed(seed, 'lift-particles')),
        audible,
        panDegrees: cue.shotPanDegrees ?? 0,
        tiltDegrees: cue.shotTiltDegrees ?? 0,
      });
    });
  }

  /** Seek using nearest snapshot if available, otherwise full rebuild. */
  private seekTo(target: number, options: { useSnapshots?: boolean } = {}): void {
    const snap = options.useSnapshots === false ? null : this.findSnapshot(target);
    // A lossy snapshot's particles lose their behaviour callbacks on restore
    // (see restoreSnapshot), so head colour-evolution freezes if we advance
    // past it. When the nearest snapshot is lossy and the target sits beyond
    // it, restore the nearest accurate snapshot instead — however far back —
    // and resimulate forward, so opening/closing colours replay correctly.
    // Priming seeds a clean t=0 snapshot, so a primed engine always has one;
    // this is strictly cheaper than the old from-zero rebuild, which stalled
    // the main thread for seconds on long shows and wiped the primed cache.
    // While scrubbing, accept the lossy restore anyway: a from-zero rebuild on
    // every drag tick froze the timeline on busy shows, and the slight fidelity
    // loss is repaired by the accurate re-seek when the drag ends.
    const snapExact = snap && snap.time <= target && !(snap.lossy && target > snap.time + 0.0001);
    // Any scrub-mode seek is approximate (lossy restores are accepted and the
    // catch-up advance runs at the coarse drag step), so flag it for the
    // accurate repair re-seek when the drag ends.
    if (this.scrubbing) this.needsAccurateReseek = true;
    let restore = snapExact ? snap : null;
    if (!restore && this.scrubbing && snap && snap.time <= target) restore = snap;
    if (!restore && snap) restore = this.findCleanSnapshotAtOrBefore(target);
    if (restore) {
      this.restoreSnapshot(restore.state);
      this.elapsed = restore.time;
      this.time = restore.time;
      this.scheduler.resetFiredAfter(restore.time);
      this.nextSnapshotAt = restore.time + this.SNAPSHOT_INTERVAL;
      this.syncGeometry();
      if (target > restore.time) this.advanceTo(target, false);
      return;
    }
    this.pool.reset();
    this.lights.reset();
    this.scheduler.resetAll();
    this.elapsed = 0;
    this.time = 0;
    // Keep a primed snapshot cache alive across a from-zero rebuild: its
    // entries are deterministic states for their times and stay valid. Wiping
    // them here left every subsequent scrub without snapshots, so each drag
    // rebuilt the whole show from zero and the timeline turned to treacle.
    if (!this.primed) {
      this.snapshots.length = 0;
      this.nextSnapshotAt = 0;
    }
    this.syncGeometry();
    if (target > 0) this.advanceTo(target, false);
  }

  private advanceTo(target: number, audible: boolean): void {
    const dt = audible ? FIXED_DT : this.scrubbing ? SCRUB_DRAG_DT : SCRUB_DT;
    let cursor = this.elapsed;
    this.effects.setAudible(audible);
    const boundaryCues = this.scheduler.pop(cursor, cursor);
    for (const cue of boundaryCues) this.fireCue(cue, audible);
    while (cursor + 0.0001 < target) {
      const next = Math.min(target, cursor + dt);
      const due = this.scheduler.pop(cursor, next);
      // Existing particles advance to the boundary first. Dispatching a cue
      // before this tick gave a newly launched shell time from before its own
      // launch and moved its apex up to one frame early.
      this.tickPhysics(next - cursor);
      cursor = next;
      for (const cue of due) this.fireCue(cue, audible);
      // Capture every interval even when callback-driven heads/flashes are
      // alive. Those callbacks are not serialised, so such snapshots restore
      // slightly lossy (a head may miss a few trail emissions for the fraction
      // of a second after the seek), but skipping them left the cache empty in
      // busy shows and forced a from-zero rebuild on every scrub, freezing the
      // timeline. Tag them so seeks can prefer an accurate snapshot when nearby.
      // Single-firework previews bypass snapshot seeks (see setElapsed), so skip
      // capture there: the cache would never be read, and re-allocating packed
      // particle buffers on every from-zero rebuild made dense brocade scrubbing
      // janky. Scrub-mode drags also skip capture: they can advance from a
      // lossy restore, and captures taken from that state would poison the
      // primed cache with degraded snapshots. Primed engines skip capture too:
      // the cache already covers the show, and duplicate pushes would grow the
      // array past MAX_SNAPSHOTS and shift out the earliest entries (including
      // the clean t=0 snapshot accurate re-seeks fall back to).
      if (
        this.scheduler.size() > 1 &&
        !this.scrubbing &&
        !this.primed &&
        cursor >= this.nextSnapshotAt
      ) {
        this.snapshots.push({
          time: cursor,
          state: this.captureSnapshot(),
          lossy: this.poolHasLiveCallbackParticles(),
        });
        if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift();
        this.nextSnapshotAt = cursor + this.SNAPSHOT_INTERVAL;
      }
    }
    this.elapsed = target;
    this.syncGeometry();
  }

  private tickPhysics(dt: number): void {
    this.time += dt;
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const count = this.pool.aliveCount;
    for (let slot = 0; slot < count; slot++) {
      const p = ps[live[slot]];
      if (!p.alive) continue;
      const headStyleSlot = p.headStyleSlot;
      this.pool.withHeadStyleSlot(headStyleSlot, () => p.update(dt, this.time));
    }
    this.pool.compactAliveMax();
    this.lights.update();
  }

  private syncGeometry(): void {
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const positions = this.positions;
    const colors = this.colors;
    const sizes = this.sizes;
    const shapes = this.shapes;
    const rotations = this.rotations;
    const pointHeadStyleA = this.pointHeadStyleA;
    const pointHeadStyleB = this.pointHeadStyleB;
    const pointHeadStyleC = this.pointHeadStyleC;
    const smokePositions = this.smokePositions;
    const smokeColors = this.smokeColors;
    const smokeSizes = this.smokeSizes;
    const smokeOpacities = this.smokeOpacities;
    const headPositions = this.headPositions;
    const headColors = this.headColors;
    const headSizes = this.headSizes;
    const headShapes = this.headShapes;
    const billboardHeadStyleA = this.billboardHeadStyleA;
    const billboardHeadStyleB = this.billboardHeadStyleB;
    const billboardHeadStyleC = this.billboardHeadStyleC;
    const count = this.pool.aliveCount;
    let drawCount = 0;
    let smokeDrawCount = 0;
    let headDrawCount = 0;
    for (let slot = 0; slot < count; slot++) {
      const p = ps[live[slot]];
      if (!p.alive) continue;
      // Hidden carrier particles (e.g. brocade heads switched off) still fly
      // and emit their trails, but are never drawn.
      if (p.shape <= HIDDEN_PARTICLE_SHAPE) continue;
      const isStar = p.mass <= 0.0015;
      const isHead = p.shape > 1.5;
      const isSmoke = p.mass >= 0.004 && p.mass < 0.01;
      const headStyle = isHead
        ? this.headStyleForParticle(p)
        : (this.headStylePairs[0]?.outer ?? defaultHeadRenderStyle());
      // Subtle shimmer — enough to read as "alive" without strobing. Higher
      // amplitudes and faster frequencies caused per-particle flicker that
      // looked like noise rather than burning chemistry. Head orbs are exempt:
      // they are meant to read as a steady, constant core, so they never twinkle.
      const twinkle = isStar && !isHead ? 0.9 + 0.1 * Math.sin(p.life * 4 + p.i * 0.5) : 1;
      const alpha = renderParticleAlpha(p, headStyle) * twinkle * clamp(p.alpha, 0, 1);
      if (isSmoke) {
        const si = smokeDrawCount * 3;
        smokePositions[si] = p.x;
        smokePositions[si + 1] = p.y;
        smokePositions[si + 2] = p.z;
        smokeSizes[smokeDrawCount] = renderParticleSize(p);
        smokeOpacities[smokeDrawCount] = alpha;
        smokeColors[si] = clamp(p.color.r, 0, 1);
        smokeColors[si + 1] = clamp(p.color.g, 0, 1);
        smokeColors[si + 2] = clamp(p.color.b, 0, 1);
        smokeDrawCount++;
        continue;
      }
      // Heat gradient: fresh stars (lifeRatio > 0.7) lean toward white-hot,
      // then settle into their pure burst colour as they cool — matches the
      // way burning magnesium chemistry actually looks.
      const lifeRatio = clamp(p.life / Math.max(p.maxLife, p.life, 0.001), 0, 1);
      // Brocade/head orbs keep their pure green/red; white-hot tinting made
      // them blend into the burst centre.
      const heat = isStar && p.shape < 1.5 ? Math.max(0, lifeRatio - 0.72) * 0.8 : 0;
      const cool = 1 - heat;
      const heatAdd = heat * alpha * BRIGHTNESS_BOOST;
      const red = Math.min(
        MAX_COLOR_INTENSITY,
        p.color.r * alpha * BRIGHTNESS_BOOST * cool + heatAdd,
      );
      const green = Math.min(
        MAX_COLOR_INTENSITY,
        p.color.g * alpha * BRIGHTNESS_BOOST * cool + heatAdd,
      );
      const blue = Math.min(
        MAX_COLOR_INTENSITY,
        p.color.b * alpha * BRIGHTNESS_BOOST * cool + heatAdd * 0.78,
      );
      if (
        this.headBillboardsEnabled &&
        p.shape > 1.5 &&
        headPositions &&
        headColors &&
        headSizes &&
        headShapes &&
        billboardHeadStyleA &&
        billboardHeadStyleB &&
        billboardHeadStyleC
      ) {
        const hi = headDrawCount * 3;
        headPositions[hi] = p.x;
        headPositions[hi + 1] = p.y;
        headPositions[hi + 2] = p.z;
        headColors[hi] = red;
        headColors[hi + 1] = green;
        headColors[hi + 2] = blue;
        headSizes[headDrawCount] = renderParticleSize(p);
        headShapes[headDrawCount] = p.shape;
        writeHeadRenderStyle(
          billboardHeadStyleA,
          billboardHeadStyleB,
          billboardHeadStyleC,
          headDrawCount,
          headStyle,
        );
        headDrawCount++;
        continue;
      }
      const pi = drawCount * 3;
      positions[pi] = p.x;
      positions[pi + 1] = p.y;
      positions[pi + 2] = p.z;
      sizes[drawCount] = renderParticleSize(p);
      shapes[drawCount] = p.shape;
      rotations[drawCount] = p.rotation;
      writeHeadRenderStyle(pointHeadStyleA, pointHeadStyleB, pointHeadStyleC, drawCount, headStyle);
      colors[pi] = red;
      colors[pi + 1] = green;
      colors[pi + 2] = blue;
      drawCount++;
    }
    this.geometry.setDrawRange(0, drawCount);
    this.smokeGeometry.setDrawRange(0, smokeDrawCount);
    if (this.headBillboardGeometry) this.headBillboardGeometry.instanceCount = headDrawCount;
    if (drawCount > 0) {
      const positionCount = drawCount * 3;
      this.positionAttribute.clearUpdateRanges();
      this.positionAttribute.addUpdateRange(0, positionCount);
      this.positionAttribute.needsUpdate = true;

      this.colorAttribute.clearUpdateRanges();
      this.colorAttribute.addUpdateRange(0, positionCount);
      this.colorAttribute.needsUpdate = true;

      this.sizeAttribute.clearUpdateRanges();
      this.sizeAttribute.addUpdateRange(0, drawCount);
      this.sizeAttribute.needsUpdate = true;

      this.shapeAttribute.clearUpdateRanges();
      this.shapeAttribute.addUpdateRange(0, drawCount);
      this.shapeAttribute.needsUpdate = true;

      this.rotationAttribute.clearUpdateRanges();
      this.rotationAttribute.addUpdateRange(0, drawCount);
      this.rotationAttribute.needsUpdate = true;

      const headStyleValueCount = drawCount * 4;
      for (const attribute of [
        this.pointHeadStyleAAttribute,
        this.pointHeadStyleBAttribute,
        this.pointHeadStyleCAttribute,
      ]) {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, headStyleValueCount);
        attribute.needsUpdate = true;
      }
    }
    if (smokeDrawCount > 0) {
      const smokePositionCount = smokeDrawCount * 3;
      this.smokePositionAttribute.clearUpdateRanges();
      this.smokePositionAttribute.addUpdateRange(0, smokePositionCount);
      this.smokePositionAttribute.needsUpdate = true;

      this.smokeColorAttribute.clearUpdateRanges();
      this.smokeColorAttribute.addUpdateRange(0, smokePositionCount);
      this.smokeColorAttribute.needsUpdate = true;

      this.smokeSizeAttribute.clearUpdateRanges();
      this.smokeSizeAttribute.addUpdateRange(0, smokeDrawCount);
      this.smokeSizeAttribute.needsUpdate = true;

      this.smokeOpacityAttribute.clearUpdateRanges();
      this.smokeOpacityAttribute.addUpdateRange(0, smokeDrawCount);
      this.smokeOpacityAttribute.needsUpdate = true;
    }
    if (
      headDrawCount > 0 &&
      this.headPositionAttribute &&
      this.headColorAttribute &&
      this.headSizeAttribute &&
      this.headShapeAttribute
    ) {
      const headPositionCount = headDrawCount * 3;
      this.headPositionAttribute.clearUpdateRanges();
      this.headPositionAttribute.addUpdateRange(0, headPositionCount);
      this.headPositionAttribute.needsUpdate = true;

      this.headColorAttribute.clearUpdateRanges();
      this.headColorAttribute.addUpdateRange(0, headPositionCount);
      this.headColorAttribute.needsUpdate = true;

      this.headSizeAttribute.clearUpdateRanges();
      this.headSizeAttribute.addUpdateRange(0, headDrawCount);
      this.headSizeAttribute.needsUpdate = true;

      this.headShapeAttribute.clearUpdateRanges();
      this.headShapeAttribute.addUpdateRange(0, headDrawCount);
      this.headShapeAttribute.needsUpdate = true;

      const headStyleValueCount = headDrawCount * 4;
      for (const attribute of [
        this.billboardHeadStyleAAttribute,
        this.billboardHeadStyleBAttribute,
        this.billboardHeadStyleCAttribute,
      ]) {
        if (!attribute) continue;
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, headStyleValueCount);
        attribute.needsUpdate = true;
      }
    }
  }

  private captureSnapshot(): PoolSnapshot {
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const liveCount = this.pool.aliveCount;
    let count = 0;
    for (let slot = 0; slot < liveCount; slot++) {
      if (ps[live[slot]].alive) count++;
    }
    const state: PoolSnapshot = {
      indices: new Uint32Array(count),
      data: new Float32Array(count * SNAPSHOT_STRIDE),
      current: this.pool.current,
      aliveMax: this.pool.aliveMax,
    };
    let w = 0;
    for (let slot = 0; slot < liveCount; slot++) {
      const i = live[slot];
      const p = ps[i];
      if (!p.alive) continue;
      state.indices[w] = i;
      const o = w * SNAPSHOT_STRIDE;
      state.data[o] = p.x;
      state.data[o + 1] = p.y;
      state.data[o + 2] = p.z;
      state.data[o + 3] = p.vx;
      state.data[o + 4] = p.vy;
      state.data[o + 5] = p.vz;
      state.data[o + 6] = p.life;
      state.data[o + 7] = p.size;
      state.data[o + 8] = p.alpha;
      state.data[o + 9] = p.color.r;
      state.data[o + 10] = p.color.g;
      state.data[o + 11] = p.color.b;
      state.data[o + 12] = p.mass;
      state.data[o + 13] = p.decay;
      state.data[o + 14] = p.gravity;
      state.data[o + 15] = p.drag;
      state.data[o + 16] = p.maxLife;
      state.data[o + 17] = p.shape;
      state.data[o + 18] = p.rotation;
      state.data[o + 19] = p.spin;
      state.data[o + 20] = p.fadeIn ? 1 : 0;
      state.data[o + 21] = p.headStyleSlot;
      w++;
    }
    return state;
  }

  private restoreSnapshot(state: PoolSnapshot): void {
    // Wipe live state cheaply via reset, then write back snapshot slots.
    this.pool.reset();
    this.lights.reset();
    const ps = this.pool.particles;
    for (let w = 0; w < state.indices.length; w++) {
      const i = state.indices[w];
      const p = ps[i];
      const o = w * SNAPSHOT_STRIDE;
      p.x = state.data[o];
      p.y = state.data[o + 1];
      p.z = state.data[o + 2];
      p.vx = state.data[o + 3];
      p.vy = state.data[o + 4];
      p.vz = state.data[o + 5];
      p.life = state.data[o + 6];
      p.size = state.data[o + 7];
      p.alpha = state.data[o + 8] || 0;
      p.color.setRGB(state.data[o + 9], state.data[o + 10], state.data[o + 11]);
      p.mass = state.data[o + 12];
      p.decay = state.data[o + 13];
      p.gravity = state.data[o + 14];
      p.drag = state.data[o + 15];
      p.maxLife = state.data[o + 16] || p.life;
      p.shape = state.data[o + 17] || 0;
      p.rotation = state.data[o + 18] || 0;
      p.spin = state.data[o + 19] || 0;
      p.fadeIn = state.data[o + 20] !== 0;
      p.headStyleSlot = state.data[o + 21] || 0;
      // Behaviour callbacks are lost on snapshot restore; remaining motion
      // keeps the captured physics until life expires. Acceptable for scrubbing.
      this.pool.restore(i, p);
    }
    this.pool.current = state.current;
    this.pool.aliveMax = state.aliveMax;
  }

  /**
   * Live callbacks are intentionally not serialised into snapshots. Callback
   * carriers are: heavy particles (ascending shells and the hidden ground
   * emitters for candles/fountains, mass >= 0.1), visible star/brocade heads
   * (shape >= 2), and hidden heads (shape <= HIDDEN_PARTICLE_SHAPE) — which
   * exist precisely to fly invisibly while their effect callback emits trail
   * particles, so missing them here tagged trail-only bursts as clean and
   * accurate restores silently killed their trails. Light cosmetic callbacks
   * (trail-square spread/fade, smoke wiggle) are deliberately not counted:
   * their loss is imperceptible and counting them would leave busy shows with
   * no clean snapshots at all.
   */
  private poolHasLiveCallbackParticles(): boolean {
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const count = this.pool.aliveCount;
    for (let slot = 0; slot < count; slot++) {
      const p = ps[live[slot]];
      if (!p.alive) continue;
      if (p.mass >= 0.1 || p.shape > 1.5 || p.shape <= HIDDEN_PARTICLE_SHAPE) return true;
    }
    return false;
  }

  private findSnapshot(
    target: number,
  ): { time: number; state: PoolSnapshot; lossy: boolean } | null {
    let best: { time: number; state: PoolSnapshot; lossy: boolean } | null = null;
    for (const s of this.snapshots) {
      if (s.time <= target && (!best || s.time > best.time)) best = s;
    }
    if (best && best.lossy) {
      // Prefer the nearest accurate snapshot when one sits close behind the
      // lossy best, so restores keep callback-driven effects when cheap.
      let clean: typeof best | null = null;
      for (const s of this.snapshots) {
        if (s.lossy || s.time > target || best.time - s.time > this.PREFER_CLEAN_SNAPSHOT_WINDOW) {
          continue;
        }
        if (!clean || s.time > clean.time) clean = s;
      }
      if (clean) best = clean;
    }
    return best;
  }

  /**
   * Nearest accurate (non-lossy) snapshot at or before `target`, at any
   * distance. Accurate seeks fall back to this when the nearest snapshot is
   * lossy: restoring it and resimulating forward replays behaviour-driven
   * effects correctly at strictly less cost than a from-zero rebuild.
   */
  private findCleanSnapshotAtOrBefore(
    target: number,
  ): { time: number; state: PoolSnapshot; lossy: boolean } | null {
    let best: { time: number; state: PoolSnapshot; lossy: boolean } | null = null;
    for (const s of this.snapshots) {
      if (!s.lossy && s.time <= target && (!best || s.time > best.time)) best = s;
    }
    return best;
  }

  getStats(): FireworksEngineStats {
    return {
      cues: this.scheduler.size(),
      particles: this.pool.aliveCount,
      scheduledEvents: this.scheduler.size(),
    };
  }

  /** Test/manual trigger from a specific design + launch index. */
  fireDesign(design: FireworkDesign, launchIndex = 0): void {
    const pos = this.world.getLaunchPosition(launchIndex);
    const seed = mixSeed('manual', this.elapsed, launchIndex);
    this.effects.setAudible(true);
    const headStyleSlot = this.setLayerHeadStyles(design.stars.outer.head, design.stars.core.head);
    this.pool.withHeadStyleSlot(headStyleSlot, () => {
      this.effects.fire(design, pos, {
        rng: createSeededRng(seed),
        smokeRng: createSeededRng(mixSeed(seed, 'launch-smoke')),
        liftRng: createSeededRng(mixSeed(seed, 'lift-particles')),
        audible: true,
      });
    });
  }

  dispose(): void {
    this.scene.remove(this.smokePoints);
    this.scene.remove(this.points);
    if (this.headBillboardMesh) this.scene.remove(this.headBillboardMesh);
    this.smokeGeometry.dispose();
    this.geometry.dispose();
    this.headBillboardGeometry?.dispose();
    this.smokeMaterial.dispose();
    this.material.dispose();
    this.headBillboardMaterial?.dispose();
    this.lights.dispose();
    this.world.dispose();
    if (this.camera) this.camera.remove(this.sound.listener);
  }
}

const HEAD_RENDER_STYLE_KEYS = [
  'glowPadding',
  'whiteCoreSizePercent',
  'whiteCoreBlurPercent',
  'coreSoftness',
  'coreBrightness',
  'coreOpacityFalloff',
  'glowSize',
  'glowSoftness',
  'glowOpacityFalloff',
  'glowBlur',
  'backgroundGlowOpacityFalloff',
  'backgroundGlowSoftness',
  'brightnessHoldPercent',
  'brightnessHoldExponent',
] as const satisfies readonly (keyof HeadRenderStyle)[];

function normaliseHeadRenderStyle(
  style: Partial<HeadRenderStyle> | null | undefined,
): HeadRenderStyle {
  return {
    ...normaliseFireworkHeadStyle(style),
    ...normaliseFireworkRenderTuning(style),
  };
}

function defaultHeadRenderStyle(): HeadRenderStyle {
  return {
    ...DEFAULT_FIREWORK_HEAD_STYLE,
    ...DEFAULT_FIREWORK_RENDER_TUNING,
  };
}

function defaultHeadStylePair(): HeadStylePairSnapshot {
  return {
    outer: defaultHeadRenderStyle(),
    core: defaultHeadRenderStyle(),
  };
}

function cloneHeadStylePair(pair: HeadStylePairSnapshot): HeadStylePairSnapshot {
  return {
    outer: { ...pair.outer },
    core: { ...pair.core },
  };
}

function headStylePairKey(pair: HeadStylePairSnapshot): string {
  return HEAD_RENDER_STYLE_KEYS.map((key) => `${pair.outer[key]}:${pair.core[key]}`).join('|');
}

/** Pack the shader-visible subset of a concrete outer or core head style. */
function writeHeadRenderStyle(
  styleA: Float32Array,
  styleB: Float32Array,
  styleC: Float32Array,
  index: number,
  style: HeadRenderStyle,
): void {
  const offset = index * 4;
  styleA[offset] = style.glowPadding;
  styleA[offset + 1] = style.whiteCoreSizePercent;
  styleA[offset + 2] = style.whiteCoreBlurPercent;
  styleA[offset + 3] = style.coreSoftness;
  styleB[offset] = style.coreBrightness;
  styleB[offset + 1] = style.coreOpacityFalloff;
  styleB[offset + 2] = style.glowSize;
  styleB[offset + 3] = style.glowSoftness;
  styleC[offset] = style.glowOpacityFalloff;
  styleC[offset + 1] = style.glowBlur;
  styleC[offset + 2] = style.backgroundGlowOpacityFalloff;
  styleC[offset + 3] = style.backgroundGlowSoftness;
}

function renderParticleSize(p: Particle): number {
  const base = Math.sqrt(Math.max(0, p.size));
  const isFlash = p.mass >= 0.1 && p.maxLife < 0.7;
  const isSmoke = p.mass >= 0.004 && p.mass < 0.01;
  if (isSmoke) return clamp(base * 1.25, 4, 28);
  if (isFlash) return clamp(base * 1.08, 1.4, 18);
  if (p.mass >= 0.1) return clamp(base * 1.38, 1.8, 24);
  // Glowing head orbs: larger size budget, but allowed to shrink with
  // distance so zoomed-out bursts don't read as pure glow. The cap sits
  // above the shader's square clamp so heads stay dominant when zoomed in.
  // sqrt(headSize) maps the 100..4000 slider to a ~10..63px budget with the
  // default of 900 landing at 30 — the calibrated "clearly visible orb" size.
  if (p.mass <= 0.0006) return clamp(base, 2, 240);
  if (p.mass <= 0.0015) return clamp(base * 1.55, 1.4, 34);
  if (p.mass <= 0.003) return clamp(base * 1.05, 1.0, 14);
  return clamp(base * 1.2, 1.1, 20);
}

function renderParticleAlpha(
  p: Particle,
  headStyle: HeadRenderStyle = defaultHeadRenderStyle(),
): number {
  const maxLife = Math.max(p.maxLife, p.life, 0.001);
  const lifeRatio = clamp(p.life / maxLife, 0, 1);
  const ageRatio = 1 - lifeRatio;
  const fadeIn = p.fadeIn && p.mass <= 0.003 ? clamp(ageRatio * 18, 0, 1) : 1;
  const isFlash = p.mass >= 0.1 && p.maxLife < 0.7;
  const isSmoke = p.mass >= 0.004 && p.mass < 0.01;
  if (isSmoke) {
    return clamp(Math.pow(lifeRatio, 1.18), 0, 1);
  }
  let peak = 0.34;
  if (isFlash) peak = 0.14;
  else if (p.mass >= 0.1) peak = 0.28;
  else if (p.shape > 1.5) {
    // Heads hold brightness for a configurable slice of life, then wink out.
    // The shader keeps the core opaque while this packed colour fades.
    const hold = headStyle.brightnessHoldPercent;
    const exponent = headStyle.brightnessHoldExponent;
    const holdFade = Math.pow(clamp(lifeRatio / Math.max(0.001, 1 - hold / 100), 0, 1), exponent);
    return clamp(0.7 * fadeIn * holdFade, 0, 0.82);
  } else if (p.shape > 0.5)
    peak = 0.6; // brocade trail squares read brighter
  else if (p.mass <= 0.0006)
    peak = 0.46; // glow halos: large but soft
  else if (p.mass <= 0.0015) peak = 0.82;
  else if (p.mass <= 0.003) peak = 0.2;

  const fade = Math.pow(lifeRatio, isFlash ? 1.7 : 0.96);
  return clamp(peak * fadeIn * fade, 0, 0.82);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readMaxPointSize(renderer?: THREE.WebGLRenderer): number {
  if (!renderer) return HEAD_SPRITE_MAX_SIZE;
  const gl = renderer.getContext();
  const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | number[] | null;
  const maxPointSize = range?.[1];
  return Number.isFinite(maxPointSize) ? Number(maxPointSize) : HEAD_SPRITE_MAX_SIZE;
}
