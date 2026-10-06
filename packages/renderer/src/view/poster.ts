/** One detached thumbnail canvas, reused without touching a mounted viewer. */
import * as THREE from 'three';
import { prototypeOr } from '../sim/numeric';
import { posterFraming } from '../poster/framing';
import type { Framing } from '../sim/framing';
import type { Design } from '../schema/index';
import { ParticleLayers } from './buffers';
import { GpuSprays } from './gpu-sprays';
import { OutputPass } from './output';
import { FrameProfiler } from './frame-profile';
import { SETTINGS } from './settings';
import { makeProps } from './props';
import { makeWorld, disposeTree } from './world';
import { drawViewerFrame } from './viewer-frame';
import type { Shot } from './types';

// Match the live viewer's prototype projection and capped display density.
const FOV_DEG = 45;
const NEAR_M = 0.5;
const FAR_M = 4000;
const MAX_DPR = 1.5;
const HALF_TURN_DEG = 180;

/** Owns a single small renderer for sequential PNGs; no transport, observers or audio. */
export class PosterRenderer {
  readonly renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
  });
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly layers = new ParticleLayers();
  readonly output: OutputPass;
  readonly profiler = new FrameProfiler(this.renderer.getContext());
  options: { prop?: 'mortar' | 'cake' } = {};
  readonly sprayMode = 'gpu';
  private readonly sprays = new GpuSprays(this.layers.uniforms);
  private readonly world = makeWorld(this.scene);
  private props = new THREE.Group();
  private disposed = false;
  shots: readonly Shot[] = [];
  t = 0;
  count = 0;
  gpuCandidateCount = 0;
  fillMs = 0;
  frameMs = 0;

  /** Allocates once at positive CSS-pixel dimensions, preserving the viewer's DPR and output mode. */
  constructor(width: number, height: number, forceLdr = false) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new RangeError('Poster dimensions must be positive and finite');
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.camera = new THREE.PerspectiveCamera(FOV_DEG, width / height, NEAR_M, FAR_M);
    this.scene.add(this.layers.group, this.sprays.points);
    this.output = new OutputPass(this.renderer, forceLdr);
    this.resize(width, height);
  }

  /** Resizes only the detached poster surface at positive CSS-pixel dimensions, never a live canvas. */
  resize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      throw new RangeError('Poster dimensions must be positive and finite');
    const dpr = Math.min(MAX_DPR, prototypeOr(window.devicePixelRatio, 1));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.output.resize(Math.round(width * dpr), Math.round(height * dpr));
    this.layers.uniforms.uScale.value =
      (height * dpr) / (2 * Math.tan((FOV_DEG * Math.PI) / HALF_TURN_DEG / 2));
    this.layers.uniforms.uDpr.value = dpr;
    this.world.resize(height, dpr);
  }

  /** Samples non-negative sequence seconds from the first firing, without mutating validated designs.
   * Applies optional world-metre framing and encodes the detached canvas as PNG asynchronously. */
  capture(design: Design, time_s: number, options: PosterCaptureOptions = {}): Promise<Blob> {
    if (this.disposed) throw new Error('Poster renderer is disposed');
    if (!Number.isFinite(time_s) || time_s < 0)
      throw new RangeError('Poster time must be non-negative and finite');
    this.shots = options.shots ?? [{ design }];
    this.options = { prop: options.prop ?? 'mortar' };
    this.t = time_s;
    this.scene.remove(this.props);
    disposeTree(this.props);
    this.props = makeProps(this.shots, this.options.prop ?? 'mortar');
    this.scene.add(this.props);
    this.world.setSettings(SETTINGS.stars, SETTINGS.grid);
    const framing =
      options.framing ?? posterFraming(this.shots, this.camera.aspect, this.camera.fov);
    if (![...framing.position, ...framing.target].every(Number.isFinite))
      throw new RangeError('Poster framing must contain finite world metres');
    // Apply the absolute poster camera without audience interaction clamps or easing.
    this.camera.position.fromArray(framing.position);
    this.camera.lookAt(...framing.target);
    this.camera.updateMatrixWorld();
    drawViewerFrame(this, this.sprays);
    // Invoke before returning to the event loop: the non-preserved drawing buffer is still valid.
    return new Promise((resolve, reject) => {
      this.renderer.domElement.toBlob((blob) => {
        if (blob === null) reject(new Error('Poster PNG encoding failed'));
        else resolve(blob);
      }, 'image/png');
    });
  }

  /** Frees the reusable scene, target and detached context; safe while an encoder callback is pending. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.layers.group, this.sprays.points);
    this.sprays.dispose();
    this.layers.dispose();
    disposeTree(this.scene);
    this.profiler.dispose();
    this.output.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** Optional sequence, world-metre camera and prop overrides for a still capture. */
export interface PosterCaptureOptions {
  shots?: readonly Shot[];
  framing?: Framing;
  prop?: 'mortar' | 'cake';
}
