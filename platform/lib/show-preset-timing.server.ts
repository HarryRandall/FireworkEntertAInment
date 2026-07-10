import 'server-only';

import {
  findTubeOverlap,
  MIN_PRODUCT_DURATION_SECONDS,
  type CueWindow,
} from '@/lib/cue-overlap.server';

export type PresetTimelineCue = {
  catalogueItemId: string;
  description: string;
  launchPositionIndex: number;
  timeSeconds: number;
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
  durationByCatalogueItemId: ReadonlyMap<string, number | null>,
  showDurationSeconds: number | null,
): PresetTimelineValidation {
  const accepted: AcceptedCueWindow[] = [];
  const sorted = [...cues].sort((a, b) => a.timeSeconds - b.timeSeconds);

  for (const cue of sorted) {
    if (!durationByCatalogueItemId.has(cue.catalogueItemId)) {
      return { ok: false, error: `Could not resolve the catalogue item for ${cue.description}.` };
    }

    const storedDuration = durationByCatalogueItemId.get(cue.catalogueItemId);
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

    const candidate: AcceptedCueWindow = {
      timeSeconds: cue.timeSeconds,
      durationSeconds,
      launchPositionIndex: cue.launchPositionIndex,
      description: cue.description,
    };
    const conflict = findTubeOverlap(candidate, accepted);
    if (conflict) {
      return {
        ok: false,
        error: `Position ${cue.launchPositionIndex + 1} is still busy with ${conflict.description} when ${cue.description} starts at ${formatSeconds(cue.timeSeconds)}.`,
      };
    }
    accepted.push(candidate);
  }

  return { ok: true };
}
