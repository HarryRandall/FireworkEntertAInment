/** Conversion from expanded replay cues to metre-based renderer shots. */
import type { Shot } from '@showcrafter/renderer/view';
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

export type RendererShotsResult = { ok: true; shots: Shot[] } | { ok: false; error: string };

/** Builds one shot per already-expanded cue, retaining child offsets, aiming and seeds. */
export function buildShowRendererShots(
  cues: readonly ReplayCue[],
  positions: readonly LaunchPosition[] = DEFAULT_LAUNCH_POSITIONS,
): RendererShotsResult {
  const shots: Shot[] = [];
  for (const cue of cues) {
    if (!cue.firework.design)
      return {
        ok: false,
        error: `${cue.firework.name}: ${cue.firework.designError ?? 'No valid renderer design.'}`,
      };
    const design = resolvedShowDesign(cue.firework, cue.emphasis ?? 'normal');
    if (design.launch && cue.shotPanDegrees != null) design.launch.tilt_deg = cue.shotPanDegrees;
    const position = cue.shotPositionOverride ??
      positions[cue.launchPositionIndex] ?? { x: 0, y: 0, z: 0 };
    shots.push({
      design,
      t0: cue.timeSeconds,
      tilt_deg: cue.shotTiltDegrees ?? 0,
      pan_deg: cue.shotPanDegrees ?? undefined,
      seed: cue.seedOverride ?? undefined,
      position: [position.x * LEGACY_LAUNCH_UNIT_METRES, position.z * LEGACY_LAUNCH_UNIT_METRES],
      muzzle_m: position.y === 0 ? undefined : position.y * LEGACY_LAUNCH_UNIT_METRES,
    });
  }
  return { ok: true, shots };
}
