/** Conversion from expanded replay cues to metre-based renderer shots. */
import { CAKE_WIDTH_M, CAKE_TOP_M, cakeHole, type Shot } from '@showcrafter/renderer/view';
import {
  DEFAULT_LAUNCH_POSITIONS,
  type LaunchPosition,
} from '@showcrafter/fireworks/launch-positions';
import type { ReplayCue } from '@/lib/show-domain';
import { resolvedShowDesign } from './renderer-design';

/** Metres per legacy scene unit. Old renderer geometry uses centimetres
 * (estimateFireworkVisualTopCm); saved default x = -200/0/200 becomes -2/0/2 m.
 * Apply only at the playback boundary, keeping saved shows and CSV positions unchanged.
 */
export const LEGACY_LAUNCH_UNIT_METRES = 0.01;

/** Default outward rack lean, in degrees, for unauthored aerial cues. */
export const SHOW_OUTER_LEAN_DEGREES = 8;
// Leave clearance around the cake lid and between successive audience-facing rows.
const CAKE_SLOT_SPACING_M = CAKE_WIDTH_M + 0.6;
const CAKE_FRONT_OFFSET_M = 3;
// Cakes per audience-facing row before the next row starts, so a busy rack grows
// sideways first and only a few rows deep instead of a long line towards the camera.
const CAKES_PER_ROW = 5;

export type RendererShotsResult = { ok: true; shots: Shot[] } | { ok: false; error: string };

/** Builds one shot per already-expanded cue, retaining child offsets, aiming and seeds. */
export function buildShowRendererShots(
  cues: readonly ReplayCue[],
  positions: readonly LaunchPosition[] = DEFAULT_LAUNCH_POSITIONS,
  showStaging = true,
): RendererShotsResult {
  const shots: Shot[] = [];
  const slots = showStaging
    ? cakeSlots(cues, positions)
    : new Map<string, readonly [number, number]>();
  const childIndices = new Map<string, number>();
  const xs = positions.map((position) => position.x);
  const centreX = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
  for (const cue of cues) {
    if (!cue.firework.design)
      return {
        ok: false,
        error: `${cue.firework.name}: ${cue.firework.designError ?? 'No valid renderer design.'}`,
      };
    const design = resolvedShowDesign(cue.firework, cue.emphasis ?? 'normal');
    const slot = cue.cakeId ? slots.get(cue.cakeId) : undefined;
    if (design.launch && cue.shotPanDegrees != null) design.launch.tilt_deg = cue.shotPanDegrees;
    else if (
      showStaging &&
      !slot &&
      cue.shotTiltDegrees == null &&
      cue.shotPanDegrees == null &&
      !cue.shotPositionOverride &&
      design.launch?.tilt_deg === 0 &&
      (design.kind === 'shell' || design.kind === 'rocket')
    ) {
      const launchX = positions[cue.launchPositionIndex]?.x ?? centreX;
      design.launch.tilt_deg = Math.sign(launchX - centreX) * SHOW_OUTER_LEAN_DEGREES;
    }
    const position = cue.shotPositionOverride ??
      positions[cue.launchPositionIndex] ?? { x: 0, y: 0, z: 0 };
    const childIndex = cue.cakeId ? (childIndices.get(cue.cakeId) ?? 0) : 0;
    if (cue.cakeId) childIndices.set(cue.cakeId, childIndex + 1);
    // Authored absolute child tube coordinates are local to the cake, in legacy units.
    const offset = cue.shotPositionOverride
      ? [position.x * LEGACY_LAUNCH_UNIT_METRES, position.z * LEGACY_LAUNCH_UNIT_METRES]
      : cakeHole(childIndex);
    shots.push({
      design,
      t0: cue.timeSeconds,
      tilt_deg: cue.shotTiltDegrees ?? 0,
      pan_deg: cue.shotPanDegrees ?? undefined,
      seed: cue.seedOverride ?? undefined,
      hardware: slot ? 'cake' : 'mortar',
      hardwarePosition: slot,
      position: slot
        ? [slot[0] + offset[0], slot[1] + offset[1]]
        : [position.x * LEGACY_LAUNCH_UNIT_METRES, position.z * LEGACY_LAUNCH_UNIT_METRES],
      muzzle_m: slot
        ? CAKE_TOP_M + (cue.shotPositionOverride?.y ?? 0) * LEGACY_LAUNCH_UNIT_METRES
        : position.y === 0
          ? undefined
          : position.y * LEGACY_LAUNCH_UNIT_METRES,
    });
  }
  return { ok: true, shots };
}

/** Allocates stable, non-overlapping cake footprints in rows just in front of their parent racks. */
function cakeSlots(cues: readonly ReplayCue[], positions: readonly LaunchPosition[]) {
  const slots = new Map<string, readonly [number, number]>();
  for (const cue of cues) {
    if (!cue.cakeId || slots.has(cue.cakeId)) continue;
    const rack = positions[cue.cakeLaunchPositionIndex ?? cue.launchPositionIndex] ?? {
      x: 0,
      z: 0,
    };
    // Fill each row outwards from the rack (0, +1, -1, +2, -2 ...), then step a row forward.
    let index = 0;
    let candidate: readonly [number, number];
    do {
      const row = Math.floor(index / CAKES_PER_ROW);
      const column = index % CAKES_PER_ROW;
      const side = column === 0 ? 0 : (column % 2 === 1 ? 1 : -1) * Math.ceil(column / 2);
      candidate = [
        rack.x * LEGACY_LAUNCH_UNIT_METRES + side * CAKE_SLOT_SPACING_M,
        rack.z * LEGACY_LAUNCH_UNIT_METRES + CAKE_FRONT_OFFSET_M + row * CAKE_SLOT_SPACING_M,
      ];
      index++;
    } while (
      [...slots.values()].some(
        ([x, z]) =>
          Math.abs(x - candidate[0]) < CAKE_SLOT_SPACING_M &&
          Math.abs(z - candidate[1]) < CAKE_SLOT_SPACING_M,
      )
    );
    slots.set(cue.cakeId, candidate);
  }
  return slots;
}
