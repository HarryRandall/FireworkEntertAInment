/** Browser playback coordinates stateless source sampling, GPU sprays and redraw scheduling. */
import { prototypeOr } from '../sim/numeric';
import * as THREE from 'three';
import type { Design } from '../schema/index';
import { simulate, shotDuration } from '../sim/index';
import { ParticleLayers } from './buffers';
import { GpuSprays } from './gpu-sprays';
import { FrameTimes } from './frame-times';
import { OutputPass } from './output';
import { CAKE_TOP_M, cakeHole, makeProps } from './props';
import { disposeTree, makeWorld } from './world';
import { fitReviewCamera } from './review-framing';
import type { Shot, ViewerOptions } from './types';

// Prototype projection settings, in degrees and metres.
const FOV_DEG = 45;
const NEAR_M = 0.5;
const FAR_M = 4000;
// Prototype pixel-ratio cap limits fill rate on high-density displays.
const MAX_DPR = 1.5;
// Wall clock conversion; smoothing weights follow the prototype's performance readout.
const MS_PER_SECOND = 1000;
const FPS_OLD_WEIGHT = 0.92;
const TIMING_OLD_WEIGHT = 0.9;
const HALF_TURN_DEG = 180;

/** Stateless firework playback in one owned WebGL context, with explicit resource cleanup. */
export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV_DEG, 1, NEAR_M, FAR_M);
  readonly output: OutputPass;
  readonly layers = new ParticleLayers();
  private readonly gpuSprays = new GpuSprays(this.layers.uniforms);
  sprayMode: 'cpu' | 'gpu' = 'gpu';
  shots: readonly Shot[];
  t = 0;
  speed = 1;
  playing = false;
  fps = 0;
  fillMs = 0;
  frameMs = 0;
  count = 0;
  readonly frameTimes = new FrameTimes();
  duration = 0;
  private readonly world;
  private props = new THREE.Group();
  private readonly listeners = new Set<(viewer: Viewer) => void>();
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private raf = 0;
  private last = 0;
  private dirty = true;
  private onScreen = false;
  private disposed = false;

  /** Mounts a view for stored designs; times are seconds and placement is in metres. */
  constructor(
    readonly container: HTMLElement,
    readonly options: ViewerOptions = {},
  ) {
    if (!options.design && !options.shots) throw new Error('A viewer needs a design or shots.');
    this.shots = options.shots ?? (options.design ? [{ design: options.design }] : []);
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(MAX_DPR, prototypeOr(window.devicePixelRatio, 1)));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    this.renderer.domElement.setAttribute('aria-label', 'Firework preview');
    container.appendChild(this.renderer.domElement);
    this.world = makeWorld(this.scene);
    this.scene.add(this.layers.group, this.gpuSprays.points);
    this.output = new OutputPass(this.renderer, options.forceLdr);
    this.setShots(this.shots);
    this.t = Math.max(0, Math.min(this.duration, options.startAt ?? 0));
    this.playing =
      options.autoplay !== false && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.onScreen = entries[0]?.isIntersecting ?? false;
      this.last = 0;
      if (!this.onScreen) this.cancelFrame();
      else this.invalidate();
    });
    this.intersectionObserver.observe(container);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.resize();
  }

  private visibilityChanged = (): void => {
    this.last = 0;
    if (document.hidden) this.cancelFrame();
    else this.invalidate();
  };
  private cancelFrame(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  private schedule(): void {
    if (
      !this.disposed &&
      this.raf === 0 &&
      this.onScreen &&
      !document.hidden &&
      (this.dirty || this.playing)
    )
      this.raf = requestAnimationFrame(this.frame);
  }
  private frame = (now: number): void => {
    this.raf = 0;
    if (this.disposed || !this.onScreen || document.hidden) return;
    const dt = this.last !== 0 ? (now - this.last) / MS_PER_SECOND : 0;
    this.last = now;
    if (this.playing) {
      this.frameTimes.record(dt * MS_PER_SECOND);
      this.advancePlayback(dt);
    }
    if (this.dirty || this.playing || dt > 0) {
      this.draw();
      this.dirty = false;
      this.emit();
    }
    this.schedule();
  };
  private advancePlayback(dt: number): void {
    if (dt > 0) this.fps = this.fps * FPS_OLD_WEIGHT + (1 / dt) * (1 - FPS_OLD_WEIGHT);
    const next = this.t + dt * this.speed;
    if (next > this.duration) {
      if (this.options.loop !== false && this.duration > 0) this.t = next % this.duration;
      else {
        this.t = this.duration;
        this.playing = false;
      }
    } else this.t = next;
  }
  private draw(): void {
    const start = performance.now();
    this.gpuSprays.births.reset();
    const frames = this.shots.flatMap((shot, index) => {
      const time = this.t - (shot.t0 ?? 0);
      if (time < 0 || time > shotDuration(shot.design)) return [];
      const placement =
        this.options.prop === 'cake' ? { position: cakeHole(index), muzzle_m: CAKE_TOP_M } : {};
      return [
        simulate(shot.design, time, {
          ...shot,
          ...placement,
          sprayBirth: this.sprayMode === 'gpu' ? this.gpuSprays.births.receive : undefined,
        }),
      ];
    });
    this.layers.upload(frames);
    this.gpuSprays.upload();
    this.count = frames.reduce(
      (sum, frame) => sum + frame.kinds.length,
      this.gpuSprays.births.count,
    );
    this.fillMs =
      this.fillMs * TIMING_OLD_WEIGHT + (performance.now() - start) * (1 - TIMING_OLD_WEIGHT);
    this.output.render(this.renderer, this.scene, this.camera);
    this.frameMs =
      this.frameMs * TIMING_OLD_WEIGHT + (performance.now() - start) * (1 - TIMING_OLD_WEIGHT);
  }
  private emit(): void {
    for (const listener of this.listeners) listener(this);
  }
  private resize(
    width = Math.max(1, this.container.clientWidth),
    height = Math.max(1, this.container.clientHeight),
  ): void {
    if (this.disposed) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const dpr = this.renderer.getPixelRatio();
    this.output.resize(Math.round(width * dpr), Math.round(height * dpr));
    this.layers.uniforms.uScale.value =
      (height * dpr) / (2 * Math.tan((FOV_DEG * Math.PI) / HALF_TURN_DEG / 2));
    this.layers.uniforms.uDpr.value = dpr;
    this.world.resize(height, dpr);
    this.resetCamera();
  }

  /** Selects CPU reference or GPU sprays for developer comparisons and redraws the same instant. */
  setSprayMode(mode: 'cpu' | 'gpu'): void {
    this.sprayMode = mode;
    this.frameTimes.reset();
    this.fillMs = 0;
    this.frameMs = 0;
    this.last = 0;
    this.invalidate();
  }

  /** Starts playback, restarting an ended, non-looping sequence. */
  play(): void {
    if (this.disposed) return;
    if (this.t >= this.duration) this.t = 0;
    this.playing = true;
    this.last = 0;
    this.emit();
    this.schedule();
  }
  /** Pauses playback at its current time without further idle frames. */
  pause(): void {
    if (this.disposed) return;
    this.playing = false;
    this.last = 0;
    this.emit();
  }
  /** Toggles the current playback state. */
  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }
  /** Seeks to a clamped sequence time in seconds and requests an exact redraw. */
  seek(time_s: number): void {
    if (this.disposed) return;
    this.t = Math.max(0, Math.min(this.duration, time_s));
    this.last = 0;
    this.invalidate();
    this.emit();
  }
  /** Replaces the firing sequence, rebuilding and releasing launch hardware. */
  setShots(shots: readonly Shot[]): void {
    if (this.disposed) return;
    this.shots = shots;
    this.frameTimes.reset();
    this.fillMs = 0;
    this.frameMs = 0;
    this.last = 0;
    this.duration = Math.max(0, ...shots.map((shot) => (shot.t0 ?? 0) + shotDuration(shot.design)));
    this.t = Math.min(this.t, this.duration);
    this.scene.remove(this.props);
    disposeTree(this.props);
    this.props = makeProps(shots, this.options.prop ?? 'mortar');
    this.scene.add(this.props);
    this.resetCamera();
    this.invalidate();
    this.emit();
  }
  /** Replaces the sequence with one stored design; keepCamera preserves the projection. */
  setDesign(design: Design, keepCamera = false): void {
    const position = this.camera.position.clone();
    const rotation = this.camera.rotation.clone();
    this.setShots([{ design }]);
    if (keepCamera) {
      this.camera.position.copy(position);
      this.camera.rotation.copy(rotation);
    }
  }
  /** Restores a fixed review view fitted to sampled CPU particle bounds in world metres. */
  resetCamera(): void {
    if (this.disposed) return;
    fitReviewCamera(this.camera, this.shots);
    this.invalidate();
  }
  /** Marks externally changed data dirty and schedules a visible redraw. */
  invalidate(): void {
    if (this.disposed) return;
    this.dirty = true;
    this.schedule();
  }
  /** Subscribes to playback changes and returns an unsubscribe function. */
  on(listener: (viewer: Viewer) => void): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    listener(this);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** Draws a caller-selected still through this context and returns an encoded PNG. */
  capture(width?: number, height?: number): string {
    if (this.disposed) throw new Error('Viewer is disposed.');
    if (width !== undefined && height !== undefined) this.resize(width, height);
    try {
      this.draw();
      return this.renderer.domElement.toDataURL('image/png');
    } finally {
      if (width !== undefined && height !== undefined) this.resize();
    }
  }
  /** Cancels callbacks, disconnects observers and frees all scene, target and context resources. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelFrame();
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.listeners.clear();
    this.scene.remove(this.layers.group);
    this.scene.remove(this.gpuSprays.points);
    this.gpuSprays.dispose();
    this.layers.dispose();
    disposeTree(this.scene);
    this.output.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
