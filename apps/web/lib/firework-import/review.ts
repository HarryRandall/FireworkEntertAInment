import {
  parseImportCandidateMetrics,
  parseImportReconstruction,
  type ImportCandidateMetrics,
  type ImportFitEvidence,
  type ImportReconstructionIssue,
  type ImportReconstructionPlan,
} from '@/lib/firework-import/reconstruction';
import { isRecord } from '@/lib/utils';

export type ImportOutputLike = {
  id: string;
  outputType: string;
  payload: unknown;
  createdAt: string;
};

export type ImportRunOutput = {
  id: string;
  runId: string;
  stage: string;
  sequence: number;
  outputType: string;
  schemaVersion: string;
  payload: unknown;
  createdAt: string;
};

export type ImportCandidate = {
  id: string;
  runId: string;
  ordinal: number;
  schemaVersion: string;
  reconstruction: unknown;
  score: number;
  metrics: unknown;
  validation: unknown;
  selectedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type ImportRun = {
  id: string;
  attemptNumber: number;
  requestKind: string;
  requestPrompt: string | null;
  status: string;
  stage: string;
  progress: number;
  selectedModel: string;
  videoModel: string | null;
  pipelineVersion: string;
  engineSchemaVersion: string;
  directDispatchStatus: string;
  directDispatchCallId: string | null;
  directDispatchAttemptCount: number;
  directDispatchError: string | null;
  directDispatchUpdatedAt: string | null;
  modalCallId: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  outputs: ImportRunOutput[];
  candidates: ImportCandidate[];
};

export type ImportRunHistory = {
  activeRunId: string | null;
  selectedCandidateId: string | null;
  approvedRunId: string | null;
  approvedCandidateId: string | null;
  runs: ImportRun[];
};

export type ImportReviewCheck = {
  id: string;
  label: string;
  status: 'pass' | 'warning' | 'blocker' | 'info';
  detail: string;
};

export type ImportReviewAttempt = {
  id: string;
  runId: string;
  attemptNumber: number;
  createdAt: string;
  model: string | null;
  processorVersion: string | null;
  prompt: string | null;
  candidateScore: number | null;
  selected: boolean;
  approved: boolean;
  reconstruction: ImportReconstructionPlan | null;
  reconstructionIssues: ImportReconstructionIssue[];
  metrics: ImportCandidateMetrics | null;
  validation: unknown;
  raw: unknown;
};

export type ImportReview = {
  attempts: ImportReviewAttempt[];
  selectedAttempt: ImportReviewAttempt | null;
  reconstruction: ImportReconstructionPlan | null;
  fit: ImportFitEvidence | null;
  checks: ImportReviewCheck[];
  blockers: ImportReviewCheck[];
  warnings: ImportReviewCheck[];
};

export const IMPORT_REVIEW_STEPS = [
  'Upload',
  'Analyse',
  'Reconstruct',
  'Validate',
  'Review',
  'Publish',
] as const;

// Fit scores below this are flagged for a closer look; publishing is still the admin's call.
const LOW_FIT_SCORE = 0.5;

function candidateAttempts(history: ImportRunHistory): ImportReviewAttempt[] {
  return history.runs.flatMap((run) =>
    run.candidates.map((candidate) => {
      const parsed = parseImportReconstruction(candidate.reconstruction);
      return {
        id: candidate.id,
        runId: run.id,
        attemptNumber: run.attemptNumber,
        createdAt: candidate.createdAt,
        model: run.selectedModel,
        processorVersion: run.pipelineVersion,
        prompt: run.requestPrompt,
        candidateScore: candidate.score,
        selected:
          candidate.id === history.selectedCandidateId ||
          Boolean(candidate.selectedAt && run.id === history.activeRunId),
        approved: candidate.id === history.approvedCandidateId || Boolean(candidate.approvedAt),
        reconstruction: parsed.success ? parsed.data : null,
        reconstructionIssues: parsed.success ? [] : parsed.issues,
        metrics: parseImportCandidateMetrics(candidate.metrics),
        validation: candidate.validation,
        raw: candidate.reconstruction,
      };
    }),
  );
}

function buildChecks(
  selected: ImportReviewAttempt | null,
  sourceDurationSeconds: number | null,
): ImportReviewCheck[] {
  if (!selected) {
    return [
      {
        id: 'candidate',
        label: 'Reconstruction candidate',
        status: 'blocker',
        detail: 'No reviewable reconstruction candidate has been produced.',
      },
    ];
  }

  const checks: ImportReviewCheck[] = [];
  const firstIssue = selected.reconstructionIssues[0];
  checks.push(
    selected.reconstruction
      ? {
          id: 'renderer-schema',
          label: 'Renderer designs',
          status: 'pass',
          detail: 'Every design passes the renderer schema and every shot uses a known design.',
        }
      : {
          id: 'renderer-schema',
          label: 'Renderer designs',
          status: 'blocker',
          detail: firstIssue
            ? `${firstIssue.path.join('.') || 'candidate'}: ${firstIssue.message}`
            : 'The candidate is not a renderer-fitted reconstruction. Run reconstruction again.',
        },
  );

  const validation = isRecord(selected.validation) ? selected.validation : null;
  checks.push(
    validation?.valid === true
      ? {
          id: 'worker-validation',
          label: 'Worker validation',
          status: 'pass',
          detail: 'The worker validated this candidate before storing it.',
        }
      : {
          id: 'worker-validation',
          label: 'Worker validation',
          status: 'blocker',
          detail: 'The selected candidate has no passing worker validation result.',
        },
  );

  const fit = selected.metrics?.fit ?? null;
  const shotCount = selected.reconstruction?.shots.length ?? null;
  if (!fit || (shotCount != null && fit.shots.length !== shotCount)) {
    checks.push({
      id: 'fit-evidence',
      label: 'Fit evidence',
      status: 'blocker',
      detail: 'The candidate has no per-shot fit evidence. Run reconstruction again.',
    });
  } else {
    const percent = Math.round(fit.overall * 100);
    checks.push({
      id: 'fit-evidence',
      label: 'Fit against the source',
      status: fit.overall >= LOW_FIT_SCORE ? 'pass' : 'warning',
      detail:
        fit.overall >= LOW_FIT_SCORE
          ? `The renderer simulation matches the measured video at ${percent}%.`
          : `The renderer simulation matches the measured video at only ${percent}%. Compare the previews closely.`,
    });
    if (fit.timedOut) {
      checks.push({
        id: 'fit-timeout',
        label: 'Fitting time limit',
        status: 'warning',
        detail: 'Fitting stopped at its time limit, so this is the best result found so far.',
      });
    }
  }

  const reconstruction = selected.reconstruction;
  const source = reconstruction?.source;
  if (reconstruction && sourceDurationSeconds != null && source) {
    const sourceEnd = sourceDurationSeconds - source.firstShotSeconds;
    const truncated = reconstruction.durationSeconds > sourceEnd + 0.5;
    checks.push({
      id: 'duration-alignment',
      label: 'Duration',
      status: 'info',
      detail: truncated
        ? `The product runs ${reconstruction.durationSeconds.toFixed(2)} seconds, past the end of the clip, because the last effect is still fading.`
        : `The product runs ${reconstruction.durationSeconds.toFixed(2)} seconds from the first shot.`,
    });
  }
  return checks;
}

export function buildImportReview({
  history,
  sourceDurationSeconds,
}: {
  history: ImportRunHistory;
  sourceDurationSeconds: number | null;
}): ImportReview {
  const attempts = candidateAttempts(history).sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
  const selectedAttempt =
    attempts.find((attempt) => attempt.id === history.selectedCandidateId) ??
    attempts.find((attempt) => attempt.selected) ??
    attempts[0] ??
    null;
  const checks = buildChecks(selectedAttempt, sourceDurationSeconds);
  return {
    attempts,
    selectedAttempt,
    reconstruction: selectedAttempt?.reconstruction ?? null,
    fit: selectedAttempt?.metrics?.fit ?? null,
    checks,
    blockers: checks.filter((check) => check.status === 'blocker'),
    warnings: checks.filter((check) => check.status === 'warning'),
  };
}

export function importStageIndex(status: string, stage?: string | null): number {
  if (status === 'complete') return 5;
  if (status === 'needs_review') return 4;
  if (status === 'failed') return Math.max(1, stageIndex(stage));
  return stageIndex(stage);
}

function stageIndex(stage?: string | null): number {
  const value = (stage ?? '').toLowerCase();
  if (/publish|approved|complete/.test(value)) return 5;
  if (/review/.test(value)) return 4;
  if (/valid|critic|metric/.test(value)) return 3;
  if (/candidate|reconstruct|model|render|synth/.test(value)) return 2;
  if (/probe|frame|audio|video|analyse|analyze/.test(value)) return 1;
  return 0;
}

export function importStageLabel(status: string, stage?: string | null): string {
  if (status === 'failed') return 'Failed';
  if (!stage && status === 'queued') return 'Queued';
  if (!stage && status === 'processing') return 'Processing';
  return IMPORT_REVIEW_STEPS[importStageIndex(status, stage)];
}

export function importStatusTone(
  status: string,
): 'neutral' | 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'complete') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'needs_review') return 'warning';
  if (status === 'queued' || status === 'processing') return 'info';
  return 'neutral';
}
