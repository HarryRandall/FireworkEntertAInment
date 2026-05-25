"use client";

import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ReplayCue } from "@/lib/show-domain";
import { FireworksEngine } from "@/lib/fireworks/FireworksEngine";
import {
  DEFAULT_LAUNCH_POSITIONS,
  type LaunchPosition,
} from "@/lib/fireworks/design";

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

  const positionsKey = useMemo(
    () => launchPositions.map((p) => `${p.x},${p.y},${p.z}`).join("|"),
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
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO),
    );
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

    let renderedElapsed = Number.NaN;
    let lastEngineUpdate = 0;
    function loop() {
      const eng = engineRef.current;
      const cam = cameraRef.current;
      const rend = rendererRef.current;
      const sc = sceneRef.current;
      if (!eng || !cam || !rend || !sc) return;
      const targetElapsed = playbackRef
        ? playbackRef.current
        : internalElapsedRef.current;
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
      const controlsChanged = controls.enabled ? controls.update() : false;
      if (timelineChanged || controlsChanged || forceRenderRef.current) {
        forceRenderRef.current = false;
        rend.render(sc, cam);
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
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full bg-black"
    />
  );
}
