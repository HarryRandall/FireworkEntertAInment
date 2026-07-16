import 'server-only';

import {
  findTubeOverlap,
  MIN_PRODUCT_DURATION_SECONDS,
  type CueWindow,
} from '@/lib/cue-overlap.server';
import { occupiedLaunchPositions } from '@/lib/cue-generation/show-options';

export type PresetTimelineCue = {
  catalogueItemId: string;
  description: string;
  launchPositionIndex: number;
  timeSeconds: number;
};

export type PresetTimelineProduct = {
  durationSeconds: number | null;
  occupancyDurationSeconds?: number | null;
  launchPositionOverrideIndices?: number[];
};

type AcceptedCueWindow = CueWindow & {
  description: string;
};

export type PresetTimelineValidation = { ok: true } | { ok: false; error: string };

function formatSeconds(seconds: number): string {
  return `${Number(seconds.toFixed(2))}s`;
}

/**
 * Validate a complete preset timeline against the declared show duration and
 * each catalogue item's tube occupancy. Different launch positions may overlap,
 * but one position cannot fire again until its previous item has finished.
 */
export function validatePresetTimeline(
  cues: PresetTimelineCue[],
  productByCatalogueItemId: ReadonlyMap<string, PresetTimelineProduct>,
  showDurationSeconds: number | null,
): PresetTimelineValidation {
  const accepted: AcceptedCueWindow[] = [];
  const sorted = [...cues].sort((a, b) => a.timeSeconds - b.timeSeconds);

  for (const cue of sorted) {
    const product = productByCatalogueItemId.get(cue.catalogueItemId);
    if (!product) {
      return { ok: false, error: `Could not resolve the catalogue item for ${cue.description}.` };
    }

    if (
      !Number.isInteger(cue.launchPositionIndex) ||
      cue.launchPositionIndex < 0 ||
      cue.launchPositionIndex > 2
    ) {
      return { ok: false, error: `${cue.description} has an invalid launch position.` };
    }

    const storedDuration = product.occupancyDurationSeconds ?? product.durationSeconds;
    const durationSeconds =
      storedDuration != null && Number.isFinite(storedDuration) && storedDuration > 0
        ? storedDuration
        : MIN_PRODUCT_DURATION_SECONDS;
    const endSeconds = cue.timeSeconds + durationSeconds;
    if (
      showDurationSeconds != null &&
      Number.isFinite(showDurationSeconds) &&
      endSeconds > showDurationSeconds
    ) {
      return {
        ok: false,
        error: `${cue.description} ends at ${formatSeconds(endSeconds)}, after the ${formatSeconds(showDurationSeconds)} show duration.`,
      };
    }

    const occupiedPositions = occupiedLaunchPositions(
      product,
      cue.launchPositionIndex as 0 | 1 | 2,
      3,
    );
    if (!occupiedPositions) {
      return { ok: false, error: `${cue.description} uses an unsupported launch position.` };
    }
    const candidateWindows: AcceptedCueWindow[] = occupiedPositions.map((launchPositionIndex) => ({
      timeSeconds: cue.timeSeconds,
      durationSeconds,
      launchPositionIndex,
      description: cue.description,
    }));
    for (const candidate of candidateWindows) {
      const conflict = findTubeOverlap(candidate, accepted);
      if (conflict) {
        return {
          ok: false,
          error: `Position ${candidate.launchPositionIndex + 1} is still busy with ${conflict.description} when ${cue.description} starts at ${formatSeconds(cue.timeSeconds)}.`,
        };
      }
    }
    accepted.push(...candidateWindows);
  }

  return { ok: true };
}
