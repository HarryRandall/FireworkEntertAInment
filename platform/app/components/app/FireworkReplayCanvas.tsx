'use client';

/**
 * FireworkReplayCanvas — Three.js canvas that simulates firework cues
 * for a given `elapsed` time. Used inside FireworkReplayViewer and
 * TemplateReplayPreview. Owns its own renderer/engine lifecycle and
 * is intentionally `dynamic`-imported by parents to avoid SSR.
 */
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Axis3d, Hand, RotateCcw, Settings, ZoomIn, ZoomOut } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
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
  controlsVisible?: boolean;
  onReady?: () => void;
};

const MAX_DEVICE_PIXEL_RATIO = 1.25;
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

export function FireworkReplayCanvas({
  cues,
  elapsed,
  playbackRef,
  launchPositions = DEFAULT_LAUNCH_POSITIONS,
  muted = false,
  interactive = true,
  controlsVisible = true,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FireworksEngine | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rafRef = useRef<number | null>(null);
  const internalElapsedRef = useRef(elapsed);
  const forceRenderRef = useRef(true);
  const interactionRenderUntilRef = useRef(0);
  // Current upward pan applied to keep the camera off the floor (see loop).
  const floorLiftRef = useRef(0);
  const showViewHelperRef = useRef(false);
  const [panMode, setPanMode] = useState(false);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [showViewHelper, setShowViewHelper] = useState(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const positionsKey = useMemo(
    () => launchPositions.map((p) => `${p.x},${p.y},${p.z}`).join('|'),
    [launchPositions],
  );

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
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
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
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      BLOOM_STRENGTH,
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

    const engine = new FireworksEngine(scene, launchPositions);
    engine.attachListenerToCamera(camera);
    engine.setMuted(muted);
    engineRef.current = engine;
    composer.render(0);
    onReadyRef.current?.();

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
      forceRenderRef.current = true;
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
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

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 h-full w-full bg-black" />
      {interactive ? (
        <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-1.5">
          <CanvasIconButton
            onClick={() => setShowCameraControls((open) => !open)}
            label={showCameraControls ? 'Hide camera controls' : 'Show camera controls'}
            active={showCameraControls}
            className={
              showCameraControls || controlsVisible
                ? 'opacity-100'
                : 'pointer-events-none opacity-0'
            }
          >
            <Settings size={16} strokeWidth={2} />
          </CanvasIconButton>
          {showCameraControls ? (
            <div className="flex flex-col gap-1.5">
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
                onClick={() => setShowViewHelper((on) => !on)}
                label={showViewHelper ? 'Hide XYZ axes' : 'Show XYZ axes'}
                active={showViewHelper}
              >
                <Axis3d size={16} strokeWidth={2} />
              </CanvasIconButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function CanvasIconButton({
  onClick,
  label,
  active = false,
  className = '',
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  className?: string;
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
      } ${className}`}
    >
      {children}
    </button>
  );
}
