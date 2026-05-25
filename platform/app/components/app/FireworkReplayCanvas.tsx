'use client';

/**
 * FireworkReplayCanvas — Three.js canvas that simulates firework cues
 * for a given `elapsed` time. Used inside FireworkReplayViewer and
 * TemplateReplayPreview. Owns its own renderer/engine lifecycle and
 * is intentionally `dynamic`-imported by parents to avoid SSR.
 */
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Hand, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';
import type { ReplayCue } from '@/lib/show-domain';
import { FireworksEngine } from '@/lib/fireworks/FireworksEngine';
import { DEFAULT_LAUNCH_POSITIONS, type LaunchPosition } from '@/lib/fireworks/design';

type Props = {
  cues: ReplayCue[];
  elapsed: number;
  /** Optional 60Hz playhead ref. When provided, the engine reads from it
   * instead of the throttled `elapsed` prop — letting parents update React
   * state at a lower rate while keeping playback smooth. */
  playbackRef?: MutableRefObject<number>;
  launchPositions?: LaunchPosition[];
  muted?: boolean;
  interactive?: boolean;
};

const MAX_DEVICE_PIXEL_RATIO = 1.25;

export function FireworkReplayCanvas({
  cues,
  elapsed,
  playbackRef,
  launchPositions = DEFAULT_LAUNCH_POSITIONS,
  muted = false,
  interactive = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FireworksEngine | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rafRef = useRef<number | null>(null);
  const internalElapsedRef = useRef(elapsed);
  const forceRenderRef = useRef(true);
  const [panMode, setPanMode] = useState(false);

  const positionsKey = useMemo(
    () => launchPositions.map((p) => `${p.x},${p.y},${p.z}`).join('|'),
    [launchPositions],
  );

  useEffect(() => {
    if (!playbackRef) internalElapsedRef.current = elapsed;
  }, [elapsed, playbackRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070d);
    scene.fog = new THREE.FogExp2(0x05070d, 0.00022);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100000);
    camera.position.set(0, 180, 1800);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.sortObjects = false;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 200, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // Vertical pan lets the viewer drop to ground level or rise up.
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 80;
    controls.maxDistance = 5000;
    controls.minPolarAngle = 0.05;
    // Just below horizon so the camera can sit at ground level looking up.
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.enabled = interactive;
    controls.update();
    controlsRef.current = controls;

    const engine = new FireworksEngine(scene, launchPositions);
    engine.attachListenerToCamera(camera);
    engine.setMuted(muted);
    engineRef.current = engine;

    const viewHelper = new ViewHelper(camera, renderer.domElement);
    // Top-right corner. `top` takes precedence over `bottom` in the source, so
    // setting top non-null is enough to lift the default bottom-right anchor.
    viewHelper.location.top = 12;
    viewHelper.location.right = 12;
    // Orbit around the firework focal point rather than world origin so the
    // snap-to-axis views keep the burst centred.
    viewHelper.center = controls.target;
    viewHelper.setLabels('X', 'Y', 'Z');
    const clock = new THREE.Clock();

    function onPointerUp(event: PointerEvent) {
      if (!controls.enabled) return;
      if (viewHelper.handleClick(event)) forceRenderRef.current = true;
    }
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    let renderedElapsed = Number.NaN;
    let lastEngineUpdate = 0;
    function loop() {
      const eng = engineRef.current;
      const cam = cameraRef.current;
      const rend = rendererRef.current;
      const sc = sceneRef.current;
      if (!eng || !cam || !rend || !sc) return;
      const targetElapsed = playbackRef ? playbackRef.current : internalElapsedRef.current;
      const delta = Math.abs(targetElapsed - renderedElapsed);
      const timelineChanged = Number.isNaN(renderedElapsed) || delta > 0.0001;
      // Small deltas (normal playback) flow through every frame. Large deltas
      // are scrubs — coalesce them to ~16Hz so rapid drag events collapse to
      // one seek instead of one per drag tick.
      const now = performance.now();
      const isLargeJump = delta > 0.15 && !Number.isNaN(renderedElapsed);
      const engineMayUpdate = !isLargeJump || now - lastEngineUpdate >= 60;
      if (timelineChanged && engineMayUpdate) {
        eng.setElapsed(targetElapsed);
        renderedElapsed = targetElapsed;
        lastEngineUpdate = now;
      }
      const dt = clock.getDelta();
      if (viewHelper.animating) {
        viewHelper.update(dt);
        forceRenderRef.current = true;
      }
      const controlsChanged = controls.enabled ? controls.update() : false;
      if (timelineChanged || controlsChanged || forceRenderRef.current) {
        forceRenderRef.current = false;
        rend.render(sc, cam);
        // Gizmo overlays the main pass; it manages its own viewport region.
        rend.autoClear = false;
        viewHelper.render(rend);
        rend.autoClear = true;
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
      forceRenderRef.current = true;
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      viewHelper.dispose();
      controls.dispose();
      engine.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      engineRef.current = null;
      controlsRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
    };
    // launchPositions handled by separate effect to avoid full teardown on edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setCues(cues);
    forceRenderRef.current = true;
  }, [cues]);

  useEffect(() => {
    engineRef.current?.setLaunchPositions(launchPositions);
    forceRenderRef.current = true;
    // positionsKey is the dependency surrogate so we don't re-fire on
    // referentially-different but value-equal arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey]);

  useEffect(() => {
    engineRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.enabled = interactive;
  }, [interactive]);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    ctrl.mouseButtons = {
      LEFT: panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: panMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
    };
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
    forceRenderRef.current = true;
  }

  function resetView() {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    cam.position.set(0, 180, 1800);
    ctrl.target.set(0, 200, 0);
    ctrl.update();
    forceRenderRef.current = true;
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 h-full w-full bg-black" />
      {interactive ? (
        <div className="absolute top-40 right-3 z-10 flex flex-col gap-1.5">
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
        </div>
      ) : null}
    </>
  );
}

function CanvasIconButton({
  onClick,
  label,
  active = false,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`focus-glow-action flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition-all focus:outline-none focus-visible:outline-none active:scale-[0.95] ${
        active
          ? 'border-primary/40 bg-primary-container/85 text-on-primary-container'
          : 'border-outline-variant/15 bg-surface-container-low/80 text-on-surface hover:bg-surface-container-high/90'
      }`}
    >
      {children}
    </button>
  );
}
