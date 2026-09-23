import type { GenerationMode } from '@/lib/prompt-configs';
import type { ChoreographyScore } from './quality';

export type ChoreographyPlanner = GenerationMode | 'beat';
type Candidate<T> = { cues: T[]; quality: ChoreographyScore; planner: ChoreographyPlanner };

export const MUSIC_REPAIR_TRIGGERS = { anchorAccuracy: 0.8, cadenceScore: 0.5 } as const;

export function choreographyNeedsRepair(quality: ChoreographyScore): boolean {
  return (
    quality.issues.some((issue) => issue.kind !== 'unused_launch_position') ||
    (quality.musicSync?.anchorAccuracy != null &&
      quality.musicSync.anchorAccuracy < MUSIC_REPAIR_TRIGGERS.anchorAccuracy) ||
    (quality.musicSync?.cadenceScore != null &&
      quality.musicSync.cadenceScore < MUSIC_REPAIR_TRIGGERS.cadenceScore)
  );
}

/** Inspect at most one deterministic repair candidate and choose only a valid improvement. */
export function selectChoreographyCandidate<T extends object>(params: {
  initialCues: readonly T[];
  initialPlanner: ChoreographyPlanner;
  inspect: (cues: T[]) => { cues: T[]; quality: ChoreographyScore };
  createRepair: () => T[];
}) {
  const inspect = (cues: readonly T[], planner: ChoreographyPlanner) => {
    try {
      const checked = params.inspect(cues.map((cue) => ({ ...cue })));
      if (!checked.cues.length)
        return { candidate: null, quality: checked.quality, failure: 'empty_candidate' };
      const hard = checked.quality.issues.some((issue) => issue.hard);
      return {
        candidate: hard ? null : ({ ...checked, planner } as Candidate<T>),
        quality: checked.quality,
        failure: hard ? 'hard_quality_issue' : null,
      };
    } catch {
      return { candidate: null, quality: null, failure: 'constraint_validation_failed' };
    }
  };
  const initial = inspect(params.initialCues, params.initialPlanner);
  const repairAttempted =
    params.initialPlanner !== 'beat' &&
    (!initial.candidate || choreographyNeedsRepair(initial.candidate.quality));
  const repair = repairAttempted
    ? (() => {
        try {
          return inspect(params.createRepair(), 'beat');
        } catch {
          return { candidate: null, quality: null, failure: 'repair_planning_failed' };
        }
      })()
    : null;
  let selected = initial.candidate;
  if (
    repair?.candidate &&
    (!selected ||
      repair.candidate.quality.comparisonScore > selected.quality.comparisonScore ||
      (repair.candidate.quality.comparisonScore === selected.quality.comparisonScore &&
        repair.candidate.quality.issues.length < selected.quality.issues.length))
  ) {
    selected = repair.candidate;
  }
  return {
    selected,
    report: {
      initialPlanner: params.initialPlanner,
      initialScore: initial.quality?.comparisonScore ?? null,
      initialMusicSync: initial.quality?.musicSync ?? null,
      initialIssues: initial.quality?.issues.map((issue) => issue.kind) ?? [],
      initialFailure: initial.failure,
      repairAttempted,
      repairPlanner: repairAttempted ? 'beat' : null,
      repairScore: repair?.quality?.comparisonScore ?? null,
      repairMusicSync: repair?.quality?.musicSync ?? null,
      repairIssues: repair?.quality?.issues.map((issue) => issue.kind) ?? [],
      repairFailure: repair?.failure ?? null,
      selectedPlanner: selected?.planner ?? null,
      repairApplied: selected != null && selected === repair?.candidate,
      remainingIssues: selected?.quality.issues.map((issue) => issue.kind) ?? [],
    },
  };
}
