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
/** Smallest drawn gap between neighbouring launch positions, in metres. Bursts are
 * tens of metres across, so closer racks read as one firework. Wider saved layouts
 * keep their measured spacing; only the drawing changes, never the saved show. */
export const MIN_LAUNCH_POSITION_GAP_M = 35;
// Leave clearance around the cake lid and between successive audience-facing rows.
const CAKE_SLOT_SPACING_M = CAKE_WIDTH_M + 3.8;
const CAKE_FRONT_OFFSET_M = 6;
// Upper bound on cakes per audience-facing row for a rack with no close neighbour,
// so a busy rack grows sideways first and only a few rows deep.
const MAX_CAKES_PER_ROW = 5;
// A shot may move a little within its cake or around its mortar, never towards another rack.
const MAX_SHOT_OFFSET_M = CAKE_WIDTH_M / 2;

type StagedPosition = { x: number; y: number; z: number };

export type RendererShotsResult = { ok: true; shots: Shot[] } | { ok: false; error: string };

/** Builds one shot per already-expanded cue, retaining child offsets, aiming and seeds. */
export function buildShowRendererShots(
  cues: readonly ReplayCue[],
  positions: readonly LaunchPosition[] = DEFAULT_LAUNCH_POSITIONS,
  showStaging = true,
): RendererShotsResult {
  const shots: Shot[] = [];
  const racks = showStaging ? cakeRacks(cues, positions.length) : new Map<string, number>();
  // Only spread layouts that fire from more than one position, so a single
  // firework or cake preview stays where the camera and poster expect it.
  const used = new Set(
    cues.map(
      (cue) =>
        (cue.cakeId ? racks.get(cue.cakeId) : undefined) ??
        cue.cakeLaunchPositionIndex ??
        cue.launchPositionIndex,
    ),
  );
  const staged = stagedLaunchPositions(positions, used.size > 1);
  const slots = showStaging
    ? cakeSlots(cues, staged, racks)
    : new Map<string, readonly [number, number]>();
  const childIndices = new Map<string, number>();
  const xs = staged.map((position) => position.x);
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
      const launchX = staged[cue.launchPositionIndex]?.x ?? centreX;
      design.launch.tilt_deg = Math.sign(launchX - centreX) * SHOW_OUTER_LEAN_DEGREES;
    }
    const position = staged[cue.launchPositionIndex] ?? { x: 0, y: 0, z: 0 };
    const override = cue.shotPositionOverride;
    const childIndex = cue.cakeId ? (childIndices.get(cue.cakeId) ?? 0) : 0;
    if (cue.cakeId) childIndices.set(cue.cakeId, childIndex + 1);
    // Authored shot offsets are local to the cake or launch position, in legacy units.
    const offset = override
      ? shotOffset(override)
      : slot
        ? cakeHole(childIndex)
        : ([0, 0] as const);
    const heightOffset = (override?.y ?? 0) * LEGACY_LAUNCH_UNIT_METRES;
    const base = slot ?? ([position.x, position.z] as const);
    const muzzle = slot ? CAKE_TOP_M + heightOffset : position.y + heightOffset;
    shots.push({
      design,
      t0: cue.timeSeconds,
      tilt_deg: cue.shotTiltDegrees ?? 0,
      pan_deg: cue.shotPanDegrees ?? undefined,
      seed: cue.seedOverride ?? undefined,
      hardware: slot ? 'cake' : 'mortar',
      hardwarePosition: slot,
      position: [base[0] + offset[0], base[1] + offset[1]],
      muzzle_m: slot || muzzle !== 0 ? muzzle : undefined,
    });
  }
  return { ok: true, shots };
}

/** Clamps an authored legacy-unit offset to the cake footprint, in metres. */
function shotOffset(override: LaunchPosition): readonly [number, number] {
  const clamp = (value: number) =>
    Math.max(-MAX_SHOT_OFFSET_M, Math.min(MAX_SHOT_OFFSET_M, value * LEGACY_LAUNCH_UNIT_METRES));
  return [clamp(override.x), clamp(override.z)];
}

/**
 * Converts saved legacy positions to metres and pushes neighbours at least
 * MIN_LAUNCH_POSITION_GAP_M apart along x, keeping the layout's centre and order.
 */
function stagedLaunchPositions(
  positions: readonly LaunchPosition[],
  spreadPositions: boolean,
): StagedPosition[] {
  const metres = positions.map((position) => ({
    x: position.x * LEGACY_LAUNCH_UNIT_METRES,
    y: position.y * LEGACY_LAUNCH_UNIT_METRES,
    z: position.z * LEGACY_LAUNCH_UNIT_METRES,
  }));
  if (!spreadPositions || metres.length < 2) return metres;
  const order = metres.map((_, index) => index).sort((a, b) => metres[a].x - metres[b].x);
  const spread = [...metres.map((position) => position.x)];
  for (let i = 1; i < order.length; i++) {
    spread[order[i]] = Math.max(
      metres[order[i]].x,
      spread[order[i - 1]] + MIN_LAUNCH_POSITION_GAP_M,
    );
  }
  const first = order[0];
  const last = order[order.length - 1];
  const shift = (metres[first].x + metres[last].x) / 2 - (spread[first] + spread[last]) / 2;
  return metres.map((position, index) => ({ ...position, x: spread[index] + shift }));
}

/** Cakes per row that fit between a rack and the midpoint to its nearest neighbour. */
function cakesPerRow(rack: StagedPosition, positions: readonly StagedPosition[]): number {
  const gap = Math.min(
    ...positions.filter((other) => other !== rack).map((other) => Math.abs(other.x - rack.x)),
  );
  const sideSlots = Math.floor((gap / 2 - CAKE_WIDTH_M / 2) / CAKE_SLOT_SPACING_M);
  return Math.max(1, Math.min(MAX_CAKES_PER_ROW, 2 * sideSlots + 1));
}

/**
 * Chooses which rack lane draws each cake. A cake stays on its own position
 * unless a neighbouring position holds fewer cakes, so shows that cue every
 * cake on one position still spread across the site instead of bunching.
 */
function cakeRacks(cues: readonly ReplayCue[], rackCount: number): Map<string, number> {
  const racks = new Map<string, number>();
  const counts = Array.from({ length: rackCount }, () => 0);
  for (const cue of cues) {
    if (!cue.cakeId || racks.has(cue.cakeId)) continue;
    const own = cue.cakeLaunchPositionIndex ?? cue.launchPositionIndex;
    const candidates = [own, own - 1, own + 1].filter((rack) => rack >= 0 && rack < rackCount);
    if (candidates.length === 0) {
      racks.set(cue.cakeId, own);
      continue;
    }
    const rack = candidates.reduce((best, next) => (counts[next] < counts[best] ? next : best));
    counts[rack]++;
    racks.set(cue.cakeId, rack);
  }
  return racks;
}

/** Allocates stable, non-overlapping cake footprints in rows just in front of their racks. */
function cakeSlots(
  cues: readonly ReplayCue[],
  positions: readonly StagedPosition[],
  racks: ReadonlyMap<string, number>,
) {
  const slots = new Map<string, readonly [number, number]>();
  for (const cue of cues) {
    if (!cue.cakeId || slots.has(cue.cakeId)) continue;
    const rack = positions[
      racks.get(cue.cakeId) ?? cue.cakeLaunchPositionIndex ?? cue.launchPositionIndex
    ] ?? {
      x: 0,
      y: 0,
      z: 0,
    };
    const perRow = cakesPerRow(rack, positions);
    // Fill each row outwards from the rack (0, +1, -1, +2, -2 ...), then step a row forward.
    let index = 0;
    let candidate: readonly [number, number];
    do {
      const row = Math.floor(index / perRow);
      const column = index % perRow;
      const side = column === 0 ? 0 : (column % 2 === 1 ? 1 : -1) * Math.ceil(column / 2);
      candidate = [
        rack.x + side * CAKE_SLOT_SPACING_M,
        rack.z + CAKE_FRONT_OFFSET_M + row * CAKE_SLOT_SPACING_M,
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
