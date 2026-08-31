type SimulationPosition = {
  x: number;
  y: number;
  z: number;
};

type SimulationCue = {
  id: string;
  position: number;
  timeSeconds: number;
  productId: string;
  seedOverride?: number | null;
  launchPositionIndex: number;
  emphasis?: 'normal' | 'accent' | 'peak';
  shotPanDegrees?: number | null;
  shotTiltDegrees?: number | null;
  shotPositionOverride?: SimulationPosition | null;
  firework: {
    id: string;
    caliber: string | null;
    durationSeconds: number | null;
    renderDesign: unknown;
    rawSpec: unknown;
  };
};

function hashDesign(design: unknown): string {
  if (design == null) return '';
  let serialised: string;
  try {
    serialised = JSON.stringify(design);
  } catch {
    serialised = String(design);
  }

  let hash = 5381;
  for (let index = 0; index < serialised.length; index += 1) {
    hash = ((hash << 5) + hash + serialised.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Stable signature for every cue value that changes renderer simulation output. */
export function replayCuesSimulationKey(cues: readonly SimulationCue[]): string {
  return JSON.stringify(
    cues.map((cue) => [
      cue.id,
      cue.position,
      cue.timeSeconds,
      cue.productId,
      cue.firework.id,
      cue.launchPositionIndex,
      cue.seedOverride ?? null,
      cue.emphasis ?? 'normal',
      cue.shotPanDegrees ?? 0,
      cue.shotTiltDegrees ?? 0,
      cue.shotPositionOverride?.x ?? 0,
      cue.shotPositionOverride?.y ?? 0,
      cue.shotPositionOverride?.z ?? 0,
      cue.firework.caliber ?? null,
      cue.firework.durationSeconds ?? null,
      hashDesign(cue.firework.renderDesign ?? cue.firework.rawSpec),
    ]),
  );
}

/** Snapshot caches also depend on the world-space launch position coordinates. */
export function replaySimulationCacheKey(
  cues: readonly SimulationCue[],
  launchPositions: readonly SimulationPosition[],
): string {
  return JSON.stringify([
    replayCuesSimulationKey(cues),
    launchPositions.map((position) => [position.x, position.y, position.z]),
  ]);
}
