// Validate producer clocks and cross-field invariants before planner timing reads them.
import { z } from 'zod';
import { analysisStructureSchema } from './analysis.generated.ts';

// Producer tolerances in seconds: event grid rounding and decoded duration headroom.
const GRID_TOLERANCE_SECONDS = 0.06;
const DURATION_HEADROOM_SECONDS = 0.75;
type Structure = z.infer<typeof analysisStructureSchema>;

function ordered(values: number[], strict: boolean): boolean {
  return values.every((value, index) => {
    const previous = values[index - 1];
    return previous === undefined || (strict ? value > previous : value >= previous);
  });
}

function timelineValid(analysis: Structure): boolean {
  const timelines: [number[], boolean][] = [
    [analysis.beat_times, true],
    [analysis.onset_times, false],
    [analysis.downbeat_times, true],
    [analysis.energy_timeline.map((point) => point.time), true],
    [analysis.key_moments.map((moment) => moment.time), false],
    [analysis.buildups.map((buildup) => buildup.peak), false],
    [analysis.firework_cues.map((cue) => cue.time), false],
  ];
  const limit = analysis.duration_seconds + DURATION_HEADROOM_SECONDS;
  const timed = [
    ...timelines.flatMap(([values]) => values),
    ...analysis.sections.map((section) => section.end),
    ...analysis.firework_cues.map((cue) => cue.end ?? cue.time),
    ...analysis.derived.anchor_windows.map((window) => window.end),
    analysis.derived.finale_window?.end ?? 0,
  ];
  return (
    timelines.every(([values, strict]) => ordered(values, strict)) &&
    timed.every((value) => value <= limit)
  );
}

function rangesValid(analysis: Structure): boolean {
  const sectionsValid = analysis.sections.every((section, index) => {
    const previous = analysis.sections[index - 1];
    return (
      section.end >= section.start &&
      Math.abs(section.duration - (section.end - section.start)) <= GRID_TOLERANCE_SECONDS &&
      (previous === undefined || section.start >= previous.end)
    );
  });
  const buildupsValid = analysis.buildups.every(
    (buildup) =>
      buildup.peak >= buildup.start &&
      Math.abs(buildup.duration - (buildup.peak - buildup.start)) <= GRID_TOLERANCE_SECONDS,
  );
  const cuesValid = analysis.firework_cues.every(
    (cue) => cue.end === null || cue.end === undefined || cue.end >= cue.time,
  );
  const finale = analysis.derived.finale_window;
  return (
    sectionsValid && buildupsValid && cuesValid && (finale === null || finale.end >= finale.start)
  );
}

function anchorsValid(analysis: Structure): boolean {
  return analysis.derived.anchor_windows.every(
    (window) =>
      window.end >= window.start &&
      window.anchor_time >= window.start &&
      window.anchor_time <= window.end &&
      (window.type === 'climax'
        ? window.energy !== null && window.energy !== undefined
        : window.energy_rise !== null && window.energy_rise !== undefined),
  );
}

function sectionIndicesValid(analysis: Structure): boolean {
  const count = analysis.sections.length;
  const derived = analysis.derived;
  const indices = [derived.quietest_section_index, derived.highest_energy_section_index];
  const rank = derived.section_rank_by_energy;
  return (
    indices.every((index) => index === null || index < count) &&
    rank.length === count &&
    new Set(rank).size === count &&
    rank.every((index) => index < count)
  );
}

function barGridValid(analysis: Structure): boolean {
  let beatIndex = 0;
  // Linear ordered-grid matching avoids quadratic scans on long songs.
  return analysis.downbeat_times.every((downbeat) => {
    while ((analysis.beat_times[beatIndex] ?? Infinity) < downbeat - GRID_TOLERANCE_SECONDS) {
      beatIndex += 1;
    }
    return (
      Math.abs((analysis.beat_times[beatIndex] ?? Infinity) - downbeat) <= GRID_TOLERANCE_SECONDS
    );
  });
}

/** Music input validator, retaining seconds from audio origin and the producer's immutable features. */
export const musicAnalysisSchema = analysisStructureSchema.superRefine((analysis, context) => {
  const valid =
    analysis.total_beats === analysis.beat_times.length &&
    timelineValid(analysis) &&
    rangesValid(analysis) &&
    anchorsValid(analysis) &&
    sectionIndicesValid(analysis) &&
    barGridValid(analysis);
  if (!valid)
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid music timeline or grid' });
});

/** Validated music input; all event times and durations are in seconds from the audio origin. */
export type MusicAnalysis = z.infer<typeof musicAnalysisSchema>;
