/** Browser playback coordinates stateless source sampling, GPU sprays and redraw scheduling. */
import { ViewerSound } from './sound/scheduler';
import { prototypeOr } from '../sim/numeric';
import * as THREE from 'three';
import type { Design } from '../schema/index';
import { shotDuration, framingFor, shakeEvents, type Vec3 } from '../sim/index';
import { ParticleLayers } from './buffers';
import { GpuSprays } from './gpu-sprays';
import { FrameProfiler } from './frame-profile';
import { FrameTimes } from './frame-times';
import { OutputPass } from './output';
import { makeProps } from './props';
import { disposeTree, makeWorld } from './world';
import { StageControls } from './stage-controls';
import { onSettings, onVisualSettings } from './settings';
import { viewerInput, mountViewerSurface } from './viewer-input';
import { buildPlayer } from './player';
import {
  drawViewerFrame,
  advanceViewerPlayback,
  applyViewerShake,
  applyViewerSettings,
  resetViewerReadout,
  soundShots,
  disposeViewerScene,
} from './viewer-frame';
import type { Shot, ViewerOptions } from './types';

// Prototype projection settings, in degrees and metres.
const FOV_DEG = 45;
const NEAR_M = 0.5;
const FAR_M = 4000;
// Prototype pixel-ratio cap limits fill rate on high-density displays.
const MAX_DPR = 1.5;
// Wall clock milliseconds per second.
const MS_PER_SECOND = 1000;
const HALF_TURN_DEG = 180;

/** Stateless firework playback in one owned WebGL context, with explicit resource cleanup. */
export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV_DEG, 1, NEAR_M, FAR_M);
  readonly output: OutputPass;
  readonly profiler: FrameProfiler;
  readonly controls: StageControls;
  private readonly cleanups: (() => void)[] = [];
  private readonly sound = new ViewerSound();
  private cameraMoving = false;
  private shake = shakeEvents([]);
  private readonly shakeOffset: Vec3 = [0, 0, 0];
  private readonly cameraPosition: Vec3 = [0, 0, 0];
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
  gpuCandidateCount = 0;
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
    this.profiler = new FrameProfiler(this.renderer.getContext());
    this.renderer.setPixelRatio(Math.min(MAX_DPR, prototypeOr(window.devicePixelRatio, 1)));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.cleanups.push(mountViewerSurface(container, this.renderer.domElement));
    this.controls = new StageControls(this.camera, this.renderer.domElement, () => {
      this.invalidate();
    });
    this.controls.enabled = options.controls !== false;
    this.cleanups.push(
      viewerInput(this, container, this.renderer.domElement, options.clickToPause !== false),
    );
    this.world = makeWorld(this.scene);
    this.scene.add(this.layers.group, this.gpuSprays.points);
    this.output = new OutputPass(this.renderer, options.forceLdr);
    this.cleanups.push(
      onVisualSettings(applyViewerSettings.bind(null, this, this.world)),
      onSettings(() => {
        this.sound.configure();
        this.emit();
      }),
    );
    this.setShots(this.shots);
    this.t = Math.max(0, Math.min(this.duration, options.startAt ?? 0));
    this.playing =
      options.autoplay !== false && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (options.ui === true) this.cleanups.push(buildPlayer(this));
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver(this.intersectionChanged.bind(this));
    this.intersectionObserver.observe(container);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.resize();
    this.sound.listen();
  }

  private intersectionChanged(entries: IntersectionObserverEntry[]): void {
    // This observer owns one stage; a batch can contain both its exit and re-entry.
    // Use the latest queued state or an earlier exit can strand a dirty draw without a RAF.
    const latest = entries.at(-1);
    if (!latest || this.disposed) return;
    this.onScreen = latest.isIntersecting;
    this.last = 0;
    if (!this.onScreen) this.cancelFrame();
    else this.invalidate();
  }
  private visibilityChanged = (): void => {
    this.last = 0;
    if (document.hidden) this.cancelFrame();
    else this.invalidate();
  };
  private cancelFrame(): void {
    this.sound.hush();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  private schedule(): void {
    if (
      !this.disposed &&
      this.raf === 0 &&
      this.onScreen &&
      !document.hidden &&
      (this.dirty || this.playing || this.profiler.waiting || this.cameraMoving)
    )
      this.raf = requestAnimationFrame(this.frame);
  }
  private frame = this.drawFrame.bind(this);
  private drawFrame(now: number): void {
    this.raf = 0;
    if (this.disposed || !this.onScreen || document.hidden) return;
    const dt = this.last !== 0 ? (now - this.last) / MS_PER_SECOND : 0;
    this.last = now;
    if (this.playing) {
      this.frameTimes.record(dt * MS_PER_SECOND);
      this.advancePlayback(dt);
    }
    this.cameraMoving = this.controls.update(now);
    this.sound.frame(this);
    if (this.profiler.poll()) this.emit();
    if (this.dirty || this.playing || this.cameraMoving) {
      applyViewerShake(this, this.shake, this.shakeOffset, this.cameraPosition);
      drawViewerFrame(this, this.gpuSprays);
      this.dirty = false;
      this.emit();
    }
    this.schedule();
  }
  private advancePlayback(dt: number): void {
    if (advanceViewerPlayback(this, dt)) this.dirty = true;
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
    if (!this.controls.touched) this.resetCamera(true);
    else this.invalidate();
  }

  /** Captures phase timings for the next visible draw without changing show time. */
  profileFrame(): void {
    this.profiler.request();
    this.invalidate();
  }

  /** Selects CPU reference or GPU sprays for developer comparisons and redraws the same instant. */
  setSprayMode(mode: 'cpu' | 'gpu'): void {
    this.sprayMode = mode;
    resetViewerReadout(this);
    this.last = 0;
    this.invalidate();
  }

  /** Starts playback, restarting an ended, non-looping sequence. */
  play(): void {
    if (this.disposed) return;
    if (this.t >= this.duration) this.t = 0;
    this.sound.reset(this.t);
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
    this.cancelFrame();
    this.controls.stop();
    this.cameraMoving = false;
    this.invalidate();
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
    if (!Number.isFinite(time_s)) throw new RangeError('Seek time must be finite');
    this.t = Math.max(0, Math.min(this.duration, time_s));
    this.sound.reset(this.t);
    this.last = 0;
    this.invalidate();
    this.emit();
  }
  /** Sets a finite positive speed multiplier; one means real time. */
  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0)
      throw new RangeError('Playback speed must be positive');
    if (this.disposed) return;
    this.sound.reset(this.t);
    this.speed = speed;
    this.emit();
  }
  /** Replaces firing-relative seconds and metre placements; keepCamera retains the user pose. */
  setShots(shots: readonly Shot[], keepCamera = false): void {
    if (this.disposed) return;
    this.shots = shots;
    this.sound.setShots(soundShots(this));
    resetViewerReadout(this);
    this.last = 0;
    this.duration = Math.max(0, ...shots.map((shot) => (shot.t0 ?? 0) + shotDuration(shot.design)));
    this.t = Math.min(this.t, this.duration);
    this.scene.remove(this.props);
    disposeTree(this.props);
    this.props = makeProps(shots, this.options.prop ?? 'mortar');
    this.scene.add(this.props);
    this.shake = shakeEvents(shots);
    if (!keepCamera) this.resetCamera(true);
    this.invalidate();
    this.emit();
  }
  /** Replaces the sequence with one stored design; keepCamera preserves the projection. */
  setDesign(design: Design, keepCamera = false): void {
    this.setShots([{ design }], keepCamera);
  }
  /** Restores prototype framing in world metres; snap skips camera easing. */
  resetCamera(snap = false): void {
    if (this.disposed) return;
    this.controls.frame(framingFor(this.shots, false, this.camera.aspect, this.camera.fov), snap);
  }
  /** Whether live drawing owns the frame budget; background posters yield throughout playback. */
  get liveDrawPending(): boolean {
    return (
      !this.disposed &&
      this.onScreen &&
      !document.hidden &&
      (this.dirty || this.playing || this.cameraMoving)
    );
  }
  /** Marks externally changed data dirty and schedules a visible redraw. */
  invalidate(): void {
    if (this.disposed) return;
    this.dirty = true;
    // Retain the last completed draw time; pending distinguishes repeated seeks from completed draws.
    this.renderer.domElement.dataset.drawPending = 'true';
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
  /** Cancels callbacks, disconnects observers and frees all scene, target and context resources. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sound.dispose();
    this.cancelFrame();
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    for (const cleanup of this.cleanups) cleanup();
    this.controls.dispose();
    this.listeners.clear();
    disposeViewerScene(this, this.gpuSprays);
    this.renderer.domElement.remove();
  }
}
