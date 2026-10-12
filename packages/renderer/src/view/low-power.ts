/** Viewer GPU setup, and low-power playback for phones: fewer pixels, no smoke and 30 fps. */
import * as THREE from 'three';
import { prototypeOr } from '../sim/numeric';

// Prototype pixel-ratio cap limits fill rate on high-density displays.
const MAX_DPR = 1.5;
// Low-power viewers draw one device pixel per CSS pixel.
const LOW_POWER_MAX_DPR = 1;
// Thirty frames per second, in wall-clock milliseconds, less a 2 ms allowance for RAF
// jitter so a 60 Hz display reliably draws every second refresh.
const FRAME_RATE = 30;
const MS_PER_SECOND = 1000;
const JITTER_MS = 2;
const LOW_POWER_FRAME_MS = MS_PER_SECOND / FRAME_RATE - JITTER_MS;
// Devices at or below these logical cores or gigabytes of memory count as low power.
const LOW_POWER_CORES = 4;
const LOW_POWER_MEMORY_GB = 4;

/** Browser hints about the device; missing values are unknown, not low power. */
export interface DeviceHints {
  coarsePointer: boolean;
  saveData?: boolean | undefined;
  cores?: number | undefined;
  memoryGb?: number | undefined;
}

/** Whether these hints describe a phone, a data-saving browser or a weak device. */
export function isLowPowerDevice(hints: DeviceHints): boolean {
  return (
    hints.coarsePointer ||
    hints.saveData === true ||
    (hints.cores !== undefined && hints.cores <= LOW_POWER_CORES) ||
    (hints.memoryGb !== undefined && hints.memoryGb <= LOW_POWER_MEMORY_GB)
  );
}

/** Reads the current browser's hints; call only in the browser. */
export function prefersLowPower(): boolean {
  const hints = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  return isLowPowerDevice({
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    saveData: hints.connection?.saveData,
    cores: hints.hardwareConcurrency,
    memoryGb: hints.deviceMemory,
  });
}

/** Creates the viewer's WebGL renderer, with a lower pixel ratio and GPU preference in low power. */
export function createViewerRenderer(lowPower: boolean): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: lowPower ? 'low-power' : 'high-performance',
  });
  const cap = lowPower ? LOW_POWER_MAX_DPR : MAX_DPR;
  renderer.setPixelRatio(Math.min(cap, prototypeOr(window.devicePixelRatio, 1)));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  return renderer;
}

/** Whether a capped viewer should draw at RAF time `now`, given the last drawn time (ms). */
export function lowPowerFrameDue(lastDrawn: number, now: number): boolean {
  return lastDrawn === 0 || now - lastDrawn >= LOW_POWER_FRAME_MS;
}

const lastDrawn = new WeakMap<object, number>();

/**
 * Whether a viewer should submit a frame now. Full-power viewers always draw; low-power
 * viewers draw at most 30 times a second, so a skipped refresh leaves the frame pending.
 */
export function frameDue(viewer: object, lowPower: boolean, now = performance.now()): boolean {
  if (!lowPower) return true;
  if (!lowPowerFrameDue(lastDrawn.get(viewer) ?? 0, now)) return false;
  lastDrawn.set(viewer, now);
  return true;
}
