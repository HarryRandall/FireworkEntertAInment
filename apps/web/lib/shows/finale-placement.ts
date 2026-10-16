/** Finale 3D placements that reproduce the replay's drawn site, so both apps show one layout. */
import type { LaunchPosition } from '@showcrafter/fireworks/launch-positions';
import { rackLeanDegrees, stageShow } from './renderer-shots';

/** A timeline row as the export sees it, in firing order. */
export interface FinalePlacementCue {
  id: string;
  launchPositionIndex: number;
  /** True when the catalogue product is a multishot drawn as one cake. */
  isCake: boolean;
  /** True for an unauthored single aerial, which the replay leans outwards on outer racks. */
  leansOnRack: boolean;
}

/** Position name, metres (x right, y up, z towards the audience) and sideways lean. */
export interface FinalePlacement {
  positionName: string;
  coordinates: readonly [number, number, number];
  leanDeg: number;
}

function rackName(index: number): string {
  return `P-${String(index + 1).padStart(2, '0')}`;
}

/**
 * Places each row where the replay draws it: single devices on their spread rack,
 * cakes on their own slot in front of the rack they were drawn on. Finale's axes
 * match the viewer's (x right, y up, z towards the audience), so metres pass through.
 */
export function finalePlacements(
  cues: readonly FinalePlacementCue[],
  positions: readonly LaunchPosition[],
): Map<string, FinalePlacement> {
  const stageCues = cues.map((cue) => ({
    cakeId: cue.isCake ? cue.id : undefined,
    cakeLaunchPositionIndex: cue.isCake ? cue.launchPositionIndex : undefined,
    launchPositionIndex: cue.launchPositionIndex,
  }));
  const stage = stageShow(stageCues, positions);
  const cakesOnRack = new Map<number, number>();
  const slotNames = new Map<string, string>();
  const placements = new Map<string, FinalePlacement>();
  for (const cue of cues) {
    const slot = cue.isCake ? stage.slots.get(cue.id) : undefined;
    if (slot) {
      const rack = stage.racks.get(cue.id) ?? cue.launchPositionIndex;
      const slotKey = `${slot[0]}:${slot[1]}`;
      let name = slotNames.get(slotKey);
      if (!name) {
        const count = (cakesOnRack.get(rack) ?? 0) + 1;
        cakesOnRack.set(rack, count);
        name = `${rackName(rack)} C${String(count)}`;
        slotNames.set(slotKey, name);
      }
      placements.set(cue.id, {
        positionName: name,
        coordinates: [slot[0], 0, slot[1]],
        leanDeg: 0,
      });
      continue;
    }
    const position = stage.positions[cue.launchPositionIndex] ?? { x: 0, y: 0, z: 0 };
    placements.set(cue.id, {
      positionName: rackName(cue.launchPositionIndex),
      coordinates: [position.x, position.y, position.z],
      leanDeg: cue.leansOnRack ? rackLeanDegrees(stage, cue.launchPositionIndex) : 0,
    });
  }
  return placements;
}

/**
 * Finale's Coordinates cell: "X Y Z" in metres, or nine numbers when the effect
 * leans. A sideways lean is pan ±90, tilt by the lean, then spin back to face the
 * audience (Finale effects coordinate system: pan about Y, tilt towards the viewer).
 */
export function finaleCoordinates(placement: FinalePlacement): string {
  const metres = placement.coordinates.map((value) => value.toFixed(2)).join(' ');
  if (placement.leanDeg === 0) return metres;
  const side = Math.sign(placement.leanDeg);
  const pan = 90 * side;
  return `${metres} 0 0 0 ${pan.toFixed(2)} ${Math.abs(placement.leanDeg).toFixed(2)} ${(-pan).toFixed(2)}`;
}
