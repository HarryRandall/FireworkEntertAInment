"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ReplayCue } from "@/lib/shows";
import { FireworksEngine } from "@/lib/fireworks/FireworksEngine";
import {
  DEFAULT_LAUNCH_POSITIONS,
  type LaunchPosition,
} from "@/lib/fireworks/design";

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

type Props = {
  cues: ReplayCue[];
  elapsed: number;
  launchPositions?: LaunchPosition[];
  muted?: boolean;
  interactive?: boolean;
};

export function FireworkReplayCanvas({
  cues,
  elapsed,
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
  const elapsedRef = useRef(elapsed);

  const positionsKey = useMemo(
    () => launchPositions.map((p) => `${p.x},${p.y},${p.z}`).join("|"),
    [launchPositions],
  );

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.000185);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100000);
    camera.position.set(0, 600, 1500);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 400, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 400;
    controls.maxDistance = 2500;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.enabled = interactive;
    controls.update();
    controlsRef.current = controls;

    const engine = new FireworksEngine(scene, launchPositions);
    engine.attachListenerToCamera(camera);
    engine.setMuted(muted);
    engineRef.current = engine;

    function loop() {
      const eng = engineRef.current;
      const cam = cameraRef.current;
      const rend = rendererRef.current;
      const sc = sceneRef.current;
      if (!eng || !cam || !rend || !sc) return;
      eng.setElapsed(elapsedRef.current);
      controls.update();
      rend.render(sc, cam);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    function onResize() {
      const w = container?.clientWidth || 800;
      const h = container?.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
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
  }, [cues]);

  useEffect(() => {
    engineRef.current?.setLaunchPositions(launchPositions);
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
