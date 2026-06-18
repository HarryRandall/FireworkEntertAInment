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

type PoolSnapshot = {
  indices: Uint32Array;
  /** packed [x,y,z,vx,vy,vz,life,size,alpha,r,g,b,mass,decay,gravity,drag,maxLife,shape,rotation,spin,fadeIn] per particle */
  data: Float32Array;
  current: number;
  aliveMax: number;
};

export type FireworksEngineStats = {
  cues: number;
  particles: number;
  scheduledEvents: number;
};

const PARTICLE_CAPACITY = 100_000;
const FIXED_DT = 1 / 60;
// Scrub rebuilds can be coarser than playback; procedural emitters compensate
// by ageing particles across each rebuilt segment.
const SCRUB_DT = 1 / 24;
const LARGE_JUMP_SECONDS = 0.35;
const SNAPSHOT_STRIDE = 21;
const MAX_SNAPSHOTS = 120;
const BRIGHTNESS_BOOST = 1.55;
const MAX_COLOR_INTENSITY = 1.75;
const SMOKE_BRIGHTNESS_BOOST = 1.8;

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
  private smokePositions: Float32Array;
  private smokeColors: Float32Array;
  private smokeSizes: Float32Array;
  private headPositions: Float32Array | null = null;
  private headColors: Float32Array | null = null;
  private headSizes: Float32Array | null = null;
  private headShapes: Float32Array | null = null;
  private positionAttribute: THREE.BufferAttribute;
  private colorAttribute: THREE.BufferAttribute;
  private sizeAttribute: THREE.BufferAttribute;
  private shapeAttribute: THREE.BufferAttribute;
  private rotationAttribute: THREE.BufferAttribute;
  private smokePositionAttribute: THREE.BufferAttribute;
  private smokeColorAttribute: THREE.BufferAttribute;
  private smokeSizeAttribute: THREE.BufferAttribute;
  private headPositionAttribute: THREE.InstancedBufferAttribute | null = null;
  private headColorAttribute: THREE.InstancedBufferAttribute | null = null;
  private headSizeAttribute: THREE.InstancedBufferAttribute | null = null;
  private headShapeAttribute: THREE.InstancedBufferAttribute | null = null;
  private viewport = new THREE.Vector2(1, 1);

  private elapsed = 0;
  private time = 0;
  /** Snapshots keyed by elapsed seconds, used for fast backward seeks. */
  private snapshots: { time: number; state: PoolSnapshot }[] = [];
  private readonly SNAPSHOT_INTERVAL = 1.0;
  private nextSnapshotAt = 0;

  constructor(
    scene: THREE.Scene,
    launchPositions: LaunchPosition[] = DEFAULT_LAUNCH_POSITIONS,
    renderer?: THREE.WebGLRenderer,
    sceneMode: FireworkSceneMode = 'night',
  ) {
    this.scene = scene;
    this.pool = new ParticlePool(PARTICLE_CAPACITY);
    this.sound = new SoundHandler();
    void this.sound.load();
    this.lights = new Lights(scene);
    this.world = new World(scene, launchPositions, sceneMode);
    this.effects = new Effects(this.pool, this.sound, this.lights);
    this.scheduler = new Scheduler();
    this.headBillboardsEnabled = readMaxPointSize(renderer) < HEAD_SPRITE_MAX_SIZE;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        glowPadding: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_RENDER_TUNING.glowPadding,
            DEFAULT_FIREWORK_RENDER_TUNING.glowPadding,
          ),
        },
        whiteCoreSizePercent: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreSizePercent,
            DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreSizePercent,
          ),
        },
        whiteCoreBlurPercent: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreBlurPercent,
            DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreBlurPercent,
          ),
        },
        coreSoftness: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.coreSoftness,
            DEFAULT_FIREWORK_HEAD_STYLE.coreSoftness,
          ),
        },
        coreBrightness: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.coreBrightness,
            DEFAULT_FIREWORK_HEAD_STYLE.coreBrightness,
          ),
        },
        coreOpacityFalloff: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.coreOpacityFalloff,
            DEFAULT_FIREWORK_HEAD_STYLE.coreOpacityFalloff,
          ),
        },
        glowSize: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.glowSize,
            DEFAULT_FIREWORK_HEAD_STYLE.glowSize,
          ),
        },
        glowSoftness: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.glowSoftness,
            DEFAULT_FIREWORK_HEAD_STYLE.glowSoftness,
          ),
        },
        glowOpacityFalloff: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.glowOpacityFalloff,
            DEFAULT_FIREWORK_HEAD_STYLE.glowOpacityFalloff,
          ),
        },
        glowBlur: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.glowBlur,
            DEFAULT_FIREWORK_HEAD_STYLE.glowBlur,
          ),
        },
        backgroundGlowOpacityFalloff: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowOpacityFalloff,
            DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowOpacityFalloff,
          ),
        },
        backgroundGlowSoftness: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowSoftness,
            DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowSoftness,
          ),
        },
      },
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
    this.smokePositions = new Float32Array(PARTICLE_CAPACITY * 3);
    this.smokeColors = new Float32Array(PARTICLE_CAPACITY * 3);
    this.smokeSizes = new Float32Array(PARTICLE_CAPACITY);

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
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
    this.geometry.setAttribute('size', this.sizeAttribute);
    this.geometry.setAttribute('shape', this.shapeAttribute);
    this.geometry.setAttribute('rotation', this.rotationAttribute);
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
    this.smokeGeometry.setAttribute('position', this.smokePositionAttribute);
    this.smokeGeometry.setAttribute('color', this.smokeColorAttribute);
    this.smokeGeometry.setAttribute('size', this.smokeSizeAttribute);
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
    geometry.setAttribute('instancePosition', this.headPositionAttribute);
    geometry.setAttribute('instanceColor', this.headColorAttribute);
    geometry.setAttribute('instanceSize', this.headSizeAttribute);
    geometry.setAttribute('instanceShape', this.headShapeAttribute);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        glowPadding: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_RENDER_TUNING.glowPadding,
            DEFAULT_FIREWORK_RENDER_TUNING.glowPadding,
          ),
        },
        whiteCoreSizePercent: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreSizePercent,
            DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreSizePercent,
          ),
        },
        whiteCoreBlurPercent: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreBlurPercent,
            DEFAULT_FIREWORK_RENDER_TUNING.whiteCoreBlurPercent,
          ),
        },
        coreSoftness: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.coreSoftness,
            DEFAULT_FIREWORK_HEAD_STYLE.coreSoftness,
          ),
        },
        coreBrightness: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.coreBrightness,
            DEFAULT_FIREWORK_HEAD_STYLE.coreBrightness,
          ),
        },
        coreOpacityFalloff: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.coreOpacityFalloff,
            DEFAULT_FIREWORK_HEAD_STYLE.coreOpacityFalloff,
          ),
        },
        glowSize: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.glowSize,
            DEFAULT_FIREWORK_HEAD_STYLE.glowSize,
          ),
        },
        glowSoftness: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.glowSoftness,
            DEFAULT_FIREWORK_HEAD_STYLE.glowSoftness,
          ),
        },
        glowOpacityFalloff: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.glowOpacityFalloff,
            DEFAULT_FIREWORK_HEAD_STYLE.glowOpacityFalloff,
          ),
        },
        glowBlur: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.glowBlur,
            DEFAULT_FIREWORK_HEAD_STYLE.glowBlur,
          ),
        },
        backgroundGlowOpacityFalloff: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowOpacityFalloff,
            DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowOpacityFalloff,
          ),
        },
        backgroundGlowSoftness: {
          value: new THREE.Vector2(
            DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowSoftness,
            DEFAULT_FIREWORK_HEAD_STYLE.backgroundGlowSoftness,
          ),
        },
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
    this.setVec2Uniform(this.material, 'glowPadding', next.glowPadding, next.glowPadding);
    this.setVec2Uniform(
      this.material,
      'whiteCoreSizePercent',
      next.whiteCoreSizePercent,
      next.whiteCoreSizePercent,
    );
    this.setVec2Uniform(
      this.material,
      'whiteCoreBlurPercent',
      next.whiteCoreBlurPercent,
      next.whiteCoreBlurPercent,
    );
    if (this.headBillboardMaterial) {
      this.setVec2Uniform(
        this.headBillboardMaterial,
        'glowPadding',
        next.glowPadding,
        next.glowPadding,
      );
      this.setVec2Uniform(
        this.headBillboardMaterial,
        'whiteCoreSizePercent',
        next.whiteCoreSizePercent,
        next.whiteCoreSizePercent,
      );
      this.setVec2Uniform(
        this.headBillboardMaterial,
        'whiteCoreBlurPercent',
        next.whiteCoreBlurPercent,
        next.whiteCoreBlurPercent,
      );
    }
  }

  /**
   * Shape the glowing head orbs (brocade heads and star orbs): how soft the
   * coloured core reads, how hot its centre burns, and the size/softness of the
   * surrounding glow. Runtime/preview-only, like {@link setRenderTuning}.
   */
  setHeadStyle(style: Partial<FireworkHeadStyle> | null | undefined): void {
    const next = normaliseFireworkHeadStyle(style);
    const apply = (material: THREE.ShaderMaterial | null) => {
      if (!material) return;
      this.setVec2Uniform(material, 'coreSoftness', next.coreSoftness, next.coreSoftness);
      this.setVec2Uniform(material, 'coreBrightness', next.coreBrightness, next.coreBrightness);
      this.setVec2Uniform(
        material,
        'coreOpacityFalloff',
        next.coreOpacityFalloff,
        next.coreOpacityFalloff,
      );
      this.setVec2Uniform(material, 'glowSize', next.glowSize, next.glowSize);
      this.setVec2Uniform(material, 'glowSoftness', next.glowSoftness, next.glowSoftness);
      this.setVec2Uniform(
        material,
        'glowOpacityFalloff',
        next.glowOpacityFalloff,
        next.glowOpacityFalloff,
      );
      this.setVec2Uniform(material, 'glowBlur', next.glowBlur, next.glowBlur);
      this.setVec2Uniform(
        material,
        'backgroundGlowOpacityFalloff',
        next.backgroundGlowOpacityFalloff,
        next.backgroundGlowOpacityFalloff,
      );
      this.setVec2Uniform(
        material,
        'backgroundGlowSoftness',
        next.backgroundGlowSoftness,
        next.backgroundGlowSoftness,
      );
    };
    apply(this.material);
    apply(this.headBillboardMaterial);
  }

  setLayerHeadStyles(outer: FireworkStarLayer['head'], core: FireworkStarLayer['head']): void {
    const apply = (material: THREE.ShaderMaterial | null) => {
      if (!material) return;
      this.setVec2Uniform(material, 'glowPadding', outer.glowPadding, core.glowPadding);
      this.setVec2Uniform(
        material,
        'whiteCoreSizePercent',
        outer.whiteCoreSizePercent,
        core.whiteCoreSizePercent,
      );
      this.setVec2Uniform(
        material,
        'whiteCoreBlurPercent',
        outer.whiteCoreBlurPercent,
        core.whiteCoreBlurPercent,
      );
      this.setVec2Uniform(material, 'coreSoftness', outer.coreSoftness, core.coreSoftness);
      this.setVec2Uniform(material, 'coreBrightness', outer.coreBrightness, core.coreBrightness);
      this.setVec2Uniform(
        material,
        'coreOpacityFalloff',
        outer.coreOpacityFalloff,
        core.coreOpacityFalloff,
      );
      this.setVec2Uniform(material, 'glowSize', outer.glowSize, core.glowSize);
      this.setVec2Uniform(material, 'glowSoftness', outer.glowSoftness, core.glowSoftness);
      this.setVec2Uniform(
        material,
        'glowOpacityFalloff',
        outer.glowOpacityFalloff,
        core.glowOpacityFalloff,
      );
      this.setVec2Uniform(material, 'glowBlur', outer.glowBlur, core.glowBlur);
      this.setVec2Uniform(
        material,
        'backgroundGlowOpacityFalloff',
        outer.backgroundGlowOpacityFalloff,
        core.backgroundGlowOpacityFalloff,
      );
      this.setVec2Uniform(
        material,
        'backgroundGlowSoftness',
        outer.backgroundGlowSoftness,
        core.backgroundGlowSoftness,
      );
    };
    apply(this.material);
    apply(this.headBillboardMaterial);
  }

  private setVec2Uniform(
    material: THREE.ShaderMaterial,
    name: string,
    outer: number,
    core: number,
  ): void {
    const value = material.uniforms[name]?.value;
    if (value instanceof THREE.Vector2) {
      value.set(outer, core);
      return;
    }
    material.uniforms[name].value = new THREE.Vector2(outer, core);
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

  resumeAudio(): void {
    void this.sound.resume();
  }

  setCues(cues: ReplayCue[]): void {
    this.scheduler.setCues(cues);
    this.snapshots.length = 0;
    this.nextSnapshotAt = 0;
    this.seekTo(this.elapsed);
  }

  /**
   * Drive timeline. Scrubbing or large jumps silently rebuild the particle
   * state at the target time; normal forward playback emits sound.
   */
  setElapsed(target: number): void {
    const next = Math.max(0, target);
    const delta = next - this.elapsed;
    const isBackwardSeek = delta < -0.0001;
    if (isBackwardSeek) {
      this.seekTo(next, { useSnapshots: false });
      return;
    }
    if (delta > LARGE_JUMP_SECONDS) {
      this.seekTo(next);
      return;
    }
    if (delta <= 0.0001) return;
    this.advanceTo(next, true);
  }

  /** Drop all live particles & flash lights — used at end-of-show flush. */
  clear(): void {
    this.pool.reset();
    this.lights.reset();
    this.syncGeometry();
  }

  private fireCue(cue: ReplayCue, audible: boolean): void {
    const design = scaleDesignForCaliber(
      cue.firework.renderDesign ?? compileFireworkDesign({ legacySpec: cue.firework.rawSpec }),
      cue.firework.caliber,
    );
    // Head appearance is saved per design. Outer/Core styles share the global
    // material uniforms for a cue, while each head particle carries the style
    // slot encoded in its shape value.
    this.setLayerHeadStyles(design.stars.outer.head, design.stars.core.head);
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
    this.effects.fire(design, pos, {
      rng: createSeededRng(seed),
      smokeRng: createSeededRng(mixSeed(seed, 'launch-smoke')),
      liftRng: createSeededRng(mixSeed(seed, 'lift-particles')),
      audible,
      panDegrees: cue.shotPanDegrees ?? 0,
      tiltDegrees: cue.shotTiltDegrees ?? 0,
    });
  }

  /** Seek using nearest snapshot if available, otherwise full rebuild. */
  private seekTo(target: number, options: { useSnapshots?: boolean } = {}): void {
    const snap = options.useSnapshots === false ? null : this.findSnapshot(target);
    if (snap && snap.time <= target) {
      this.restoreSnapshot(snap.state);
      this.elapsed = snap.time;
      this.time = snap.time;
      this.scheduler.resetFiredAfter(snap.time);
      this.nextSnapshotAt = snap.time + this.SNAPSHOT_INTERVAL;
      this.syncGeometry();
      if (target > snap.time) this.advanceTo(target, false);
      return;
    }
    this.pool.reset();
    this.lights.reset();
    this.scheduler.resetAll();
    this.elapsed = 0;
    this.time = 0;
    this.snapshots.length = 0;
    this.nextSnapshotAt = 0;
    this.syncGeometry();
    if (target > 0) this.advanceTo(target, false);
  }

  private advanceTo(target: number, audible: boolean): void {
    const dt = audible ? FIXED_DT : SCRUB_DT;
    let cursor = this.elapsed;
    this.effects.setAudible(audible);
    while (cursor + 0.0001 < target) {
      const next = Math.min(target, cursor + dt);
      const due = this.scheduler.pop(cursor, next);
      for (const cue of due) {
        this.fireCue(cue, audible);
      }
      this.tickPhysics(next - cursor);
      cursor = next;
      // Skip frames with live callback-driven particles: those callbacks are
      // intentionally not serialised, so restoring them would change effects.
      if (cursor >= this.nextSnapshotAt && !this.poolHasLiveCallbackParticles()) {
        this.snapshots.push({ time: cursor, state: this.captureSnapshot() });
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
      if (p.alive) p.update(dt, this.time);
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
    const smokePositions = this.smokePositions;
    const smokeColors = this.smokeColors;
    const smokeSizes = this.smokeSizes;
    const headPositions = this.headPositions;
    const headColors = this.headColors;
    const headSizes = this.headSizes;
    const headShapes = this.headShapes;
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
      // Subtle shimmer — enough to read as "alive" without strobing. Higher
      // amplitudes and faster frequencies caused per-particle flicker that
      // looked like noise rather than burning chemistry. Head orbs are exempt:
      // they are meant to read as a steady, constant core, so they never twinkle.
      const twinkle = isStar && !isHead ? 0.9 + 0.1 * Math.sin(p.life * 4 + p.i * 0.5) : 1;
      const alpha = renderParticleAlpha(p) * twinkle * clamp(p.alpha, 0, 1);
      if (isSmoke) {
        const si = smokeDrawCount * 3;
        const smokeTone = alpha * SMOKE_BRIGHTNESS_BOOST;
        smokePositions[si] = p.x;
        smokePositions[si + 1] = p.y;
        smokePositions[si + 2] = p.z;
        smokeSizes[smokeDrawCount] = renderParticleSize(p);
        smokeColors[si] = clamp((p.color.r + 0.13) * smokeTone, 0, 0.52);
        smokeColors[si + 1] = clamp((p.color.g + 0.14) * smokeTone, 0, 0.54);
        smokeColors[si + 2] = clamp((p.color.b + 0.16) * smokeTone, 0, 0.58);
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
        headShapes
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
      // Behaviour callbacks are lost on snapshot restore; remaining motion
      // keeps the captured physics until life expires. Acceptable for scrubbing.
      this.pool.restore(i, p);
    }
    this.pool.current = state.current;
    this.pool.aliveMax = state.aliveMax;
  }

  /** Live callbacks are intentionally not serialised into snapshots. */
  private poolHasLiveCallbackParticles(): boolean {
    const ps = this.pool.particles;
    const live = this.pool.aliveIndices;
    const count = this.pool.aliveCount;
    for (let slot = 0; slot < count; slot++) {
      const p = ps[live[slot]];
      if (!p.alive) continue;
      if (p.mass >= 0.1 || p.shape > 1.5) return true;
    }
    return false;
  }

  private findSnapshot(target: number): { time: number; state: PoolSnapshot } | null {
    let best: { time: number; state: PoolSnapshot } | null = null;
    for (const s of this.snapshots) {
      if (s.time <= target && (!best || s.time > best.time)) best = s;
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
    this.effects.fire(design, pos, {
      rng: createSeededRng(seed),
      smokeRng: createSeededRng(mixSeed(seed, 'launch-smoke')),
      liftRng: createSeededRng(mixSeed(seed, 'lift-particles')),
      audible: true,
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
  if (p.mass <= 0.0006) return clamp(base, 4, 240);
  if (p.mass <= 0.0015) return clamp(base * 1.55, 1.4, 34);
  if (p.mass <= 0.003) return clamp(base * 1.05, 1.0, 14);
  return clamp(base * 1.2, 1.1, 20);
}

function renderParticleAlpha(p: Particle): number {
  const maxLife = Math.max(p.maxLife, p.life, 0.001);
  const lifeRatio = clamp(p.life / maxLife, 0, 1);
  const ageRatio = 1 - lifeRatio;
  const fadeIn = p.fadeIn && p.mass <= 0.003 ? clamp(ageRatio * 18, 0, 1) : 1;
  const isFlash = p.mass >= 0.1 && p.maxLife < 0.7;
  const isSmoke = p.mass >= 0.004 && p.mass < 0.01;
  if (isSmoke) {
    return clamp(0.34 * Math.pow(lifeRatio, 1.18), 0, 0.36);
  }
  let peak = 0.34;
  if (isFlash) peak = 0.14;
  else if (p.mass >= 0.1) peak = 0.28;
  else if (p.shape > 1.5) {
    // Heads hold brightness for most of their life, then wink out quickly.
    // The shader keeps the core opaque while this packed colour fades.
    const holdFade = Math.pow(clamp(lifeRatio / 0.18, 0, 1), 0.8);
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
