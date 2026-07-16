import {
  latestImportedSpecFromOutputs,
  parseImportedFireworkSpec,
  type ImportedFireworkSpec,
} from '@/lib/import-jobs';
import {
  parseImportReconstruction,
  type ImportReconstructionIssue,
  type ImportReconstructionPlan,
} from '@/lib/import-reconstruction';
import { FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION } from '@/lib/fireworks/import-renderer-contract';
import { IMPORT_RENDER_METRICS_SCHEMA_VERSION } from '@/lib/import-render-metrics';

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
  renderedVideoPath: string | null;
  /** Short-lived server-minted URL, populated only for the selected candidate. */
  renderedVideoUrl: string | null;
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
  source: 'candidate' | 'legacy_output';
  runId: string | null;
  attemptNumber: number | null;
  outputType: string;
  createdAt: string;
  model: string | null;
  processorVersion: string | null;
  prompt: string | null;
  candidateScore: number | null;
  selected: boolean;
  approved: boolean;
  spec: ImportedFireworkSpec | null;
  reconstruction: ImportReconstructionPlan | null;
  reconstructionIssues: ImportReconstructionIssue[];
  metrics: unknown;
  engineMetrics: ImportEngineMetricSummary | null;
  validation: unknown;
  renderedVideoPath: string | null;
  renderedVideoUrl: string | null;
  raw: unknown;
};

export type ImportEngineMetricField = 'timing' | 'trajectory' | 'palette' | 'fade' | 'perceptual';

export type ImportEngineMetricSummary = {
  schemaVersion: typeof IMPORT_RENDER_METRICS_SCHEMA_VERSION;
  overallScore: number;
  engine: {
    renderer: 'FireworksEngine';
    rendererVersion: typeof FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION;
    camera: 'FireworkReplayCanvas.default';
    frameCount: number;
    frameWidth: number;
    frameHeight: number;
    fixedStepSeconds: number;
  };
  components: Record<
    ImportEngineMetricField,
    {
      score: number;
      values: Record<string, number>;
    }
  >;
  priorityIssues: Array<{
    field: ImportEngineMetricField;
    score: number;
    instruction: string;
  }>;
};

export const IMPORT_ENGINE_PUBLICATION_SCORE_THRESHOLD = 0.78;
export const IMPORT_ENGINE_RENDER_VALIDATOR_VERSION =
  'showcrafter.engine-render-publication.v1' as const;
const IMPORT_ENGINE_RENDER_RESULT_SCHEMA_VERSION = 'showcrafter.import-render-result.v1';
const IMPORT_ENGINE_RENDER_HARNESS_VERSION = 'showcrafter.import-render-harness.v1';

const IMPORT_ENGINE_REVIEW_VIDEO_PATH =
  /^([0-9a-f-]{36})\/engine-review-([0-9a-f-]{36})-([0-9a-f]{16})\.mp4$/i;

/** The retained audit MP4 must name the same immutable run as its candidate. */
export function isRunOwnedImportEngineReviewVideoPath(
  renderedVideoPath: string | null,
  runId: string | null,
): boolean {
  if (!renderedVideoPath || !runId) return false;
  const match = IMPORT_ENGINE_REVIEW_VIDEO_PATH.exec(renderedVideoPath);
  return Boolean(match && match[2].toLowerCase() === runId.toLowerCase());
}

export type ImportEnginePublicationEvidence = {
  validatorVersion: typeof IMPORT_ENGINE_RENDER_VALIDATOR_VERSION;
  canonicalEvidence: Record<string, unknown>;
  metrics: ImportEngineMetricSummary;
  reviewArtifact: ImportEngineReviewArtifact;
  rendererDurations: Array<{ designKey: string; durationSeconds: number }>;
  requiredProductDurationSeconds: number;
  renderedVideoPath: string;
};

export type ImportEngineReviewArtifact = {
  storagePath: string;
  sha256: string;
  byteSize: number;
  storageETag: string;
};

export type ImportEnginePublicationEvidenceResult =
  | { success: true; data: ImportEnginePublicationEvidence }
  | { success: false; error: string };

export type ImportReview = {
  attempts: ImportReviewAttempt[];
  selectedAttempt: ImportReviewAttempt | null;
  latestSpec: ImportedFireworkSpec | null;
  reconstruction: ImportReconstructionPlan | null;
  checks: ImportReviewCheck[];
  blockers: ImportReviewCheck[];
  warnings: ImportReviewCheck[];
  engineMetrics: ImportEngineMetricSummary | null;
  engineArtifact: ImportEngineReviewArtifact | null;
  modelConfidence: number | null;
  observedBurstCount: number | null;
};

export const IMPORT_REVIEW_STEPS = [
  'Upload',
  'Analyse',
  'Reconstruct',
  'Validate',
  'Review',
  'Publish',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function boundedScore(value: unknown): number | null {
  const score = finiteNumber(value);
  return score != null && score >= 0 && score <= 1 ? score : null;
}

function recordAt(value: unknown, key: string): Record<string, unknown> | null {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}

const ENGINE_METRIC_FIELDS: ImportEngineMetricField[] = [
  'timing',
  'trajectory',
  'palette',
  'fade',
  'perceptual',
];

function engineMetricPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const engineValidation =
    recordAt(value, 'engineValidation') ?? recordAt(value, 'engine_validation');
  const engineRender = recordAt(value, 'engineRender') ?? recordAt(value, 'engine_render');
  const candidates = [
    value,
    recordAt(value, 'renderMetrics'),
    recordAt(value, 'render_metrics'),
    recordAt(value, 'engineRenderMetrics'),
    recordAt(value, 'engine_render_metrics'),
    engineRender,
    recordAt(engineRender, 'metrics'),
    engineValidation,
    recordAt(engineValidation, 'metrics'),
  ];
  return (
    candidates.find(
      (candidate) => candidate?.schemaVersion === IMPORT_RENDER_METRICS_SCHEMA_VERSION,
    ) ?? null
  );
}

/** Parse only immutable metrics recorded on the candidate row. */
export function parseImportEngineMetricSummary(value: unknown): ImportEngineMetricSummary | null {
  const payload = engineMetricPayload(value);
  if (!payload) return null;
  const overallScore = boundedScore(payload.overallScore);
  const engine = recordAt(payload, 'engine');
  const frameCount = finiteNumber(engine?.frameCount);
  const frameWidth = finiteNumber(engine?.frameWidth);
  const frameHeight = finiteNumber(engine?.frameHeight);
  const fixedStepSeconds = finiteNumber(engine?.fixedStepSeconds);
  if (
    overallScore == null ||
    engine?.renderer !== 'FireworksEngine' ||
    engine.rendererVersion !== FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION ||
    engine.camera !== 'FireworkReplayCanvas.default' ||
    frameCount == null ||
    !Number.isInteger(frameCount) ||
    frameCount < 2 ||
    frameWidth == null ||
    !Number.isInteger(frameWidth) ||
    frameWidth < 1 ||
    frameHeight == null ||
    !Number.isInteger(frameHeight) ||
    frameHeight < 1 ||
    fixedStepSeconds == null ||
    Math.abs(fixedStepSeconds - 1 / 60) > 1e-8
  ) {
    return null;
  }

  const components = {} as ImportEngineMetricSummary['components'];
  for (const field of ENGINE_METRIC_FIELDS) {
    const component = recordAt(payload, field);
    const score = boundedScore(component?.score);
    if (!component || score == null) return null;
    const values = Object.fromEntries(
      Object.entries(component).flatMap(([key, entry]) => {
        const value = finiteNumber(entry);
        return key === 'score' || value == null ? [] : [[key, value]];
      }),
    );
    components[field] = { score, values };
  }

  if (!Array.isArray(payload.priorityIssues)) return null;
  const priorityIssues = payload.priorityIssues.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const field = text(entry.field);
    const score = boundedScore(entry.score);
    const instruction = text(entry.instruction);
    if (
      !field ||
      !ENGINE_METRIC_FIELDS.includes(field as ImportEngineMetricField) ||
      score == null ||
      !instruction ||
      instruction.length > 500
    ) {
      return [];
    }
    return [{ field: field as ImportEngineMetricField, score, instruction }];
  });
  if (priorityIssues.length !== payload.priorityIssues.length) return null;

  return {
    schemaVersion: IMPORT_RENDER_METRICS_SCHEMA_VERSION,
    overallScore,
    engine: {
      renderer: 'FireworksEngine',
      rendererVersion: FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
      camera: 'FireworkReplayCanvas.default',
      frameCount,
      frameWidth,
      frameHeight,
      fixedStepSeconds,
    },
    components,
    priorityIssues,
  };
}

function engineRenderPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const direct = recordAt(value, 'engineRender') ?? recordAt(value, 'engine_render');
  if (direct) return direct;
  const metrics = recordAt(value, 'metrics');
  return recordAt(metrics, 'engineRender') ?? recordAt(metrics, 'engine_render');
}

/** Parse the immutable retained MP4 identity carried by canonical engine evidence. */
export function parseImportEngineReviewArtifact(
  value: unknown,
  expectedStoragePath: string | null = null,
): ImportEngineReviewArtifact | null {
  const payload = engineRenderPayload(value);
  const artifact = recordAt(payload, 'reviewArtifact');
  const storagePath = text(artifact?.storagePath);
  const sha256 = text(artifact?.sha256)?.toLowerCase() ?? null;
  const byteSize = finiteNumber(artifact?.byteSize);
  const storageETag = text(artifact?.storageETag)?.toLowerCase() ?? null;
  if (
    !storagePath ||
    (expectedStoragePath && storagePath !== expectedStoragePath) ||
    !/^[0-9a-f-]{36}\/engine-review-[0-9a-f-]{36}-[0-9a-f]{16}\.mp4$/i.test(storagePath) ||
    !sha256 ||
    !/^[0-9a-f]{64}$/.test(sha256) ||
    byteSize == null ||
    !Number.isSafeInteger(byteSize) ||
    byteSize < 1 ||
    !storageETag ||
    !/^[0-9a-f]{32}(?:-[1-9][0-9]*)?$/.test(storageETag)
  ) {
    return null;
  }
  return { storagePath, sha256, byteSize, storageETag };
}

/**
 * Require complete, high-fidelity engine evidence before catalogue publication.
 * Review can still show weaker candidates so an admin can request refinement.
 */
export function parseImportEnginePublicationEvidence(
  value: unknown,
  renderedVideoPath: string | null,
  reconstruction: ImportReconstructionPlan,
): ImportEnginePublicationEvidenceResult {
  const payload = engineRenderPayload(value);
  const metrics = parseImportEngineMetricSummary(recordAt(payload, 'metrics'));
  if (!payload || !metrics) {
    return { success: false, error: 'Run sampled FireworksEngine validation before publishing.' };
  }
  if (
    payload.schemaVersion !== IMPORT_ENGINE_RENDER_RESULT_SCHEMA_VERSION ||
    payload.harnessVersion !== IMPORT_ENGINE_RENDER_HARNESS_VERSION
  ) {
    return {
      success: false,
      error: 'Sampled engine evidence used an unsupported harness contract.',
    };
  }
  if (payload.rendererVersion !== FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION) {
    return { success: false, error: 'Sampled engine evidence used a stale renderer contract.' };
  }
  if (metrics.engine.frameCount < 8) {
    return { success: false, error: 'Engine validation did not include enough sampled frames.' };
  }
  if (metrics.engine.frameWidth < 64 || metrics.engine.frameHeight < 64) {
    return {
      success: false,
      error: 'Engine validation frames are too small for publication review.',
    };
  }
  if (
    metrics.overallScore < IMPORT_ENGINE_PUBLICATION_SCORE_THRESHOLD ||
    ENGINE_METRIC_FIELDS.some(
      (field) => metrics.components[field].score < IMPORT_ENGINE_PUBLICATION_SCORE_THRESHOLD,
    )
  ) {
    return {
      success: false,
      error: `Every sampled engine evidence score must reach ${Math.round(
        IMPORT_ENGINE_PUBLICATION_SCORE_THRESHOLD * 100,
      )}% before publishing.`,
    };
  }
  if (metrics.priorityIssues.length > 0) {
    return {
      success: false,
      error: 'Resolve every sampled engine evidence priority before publishing.',
    };
  }
  for (const field of ['trajectory', 'fade', 'perceptual'] as const) {
    const count = metrics.components[field].values.comparedFrameCount;
    if (!Number.isInteger(count) || count < 2) {
      return {
        success: false,
        error: `Engine ${field} evidence is missing matched sampled source and renderer frames.`,
      };
    }
  }
  if (
    !Number.isInteger(metrics.components.perceptual.values.activeFrameCount) ||
    metrics.components.perceptual.values.activeFrameCount < 2 ||
    !(metrics.components.perceptual.values.foregroundWeightTotal > 0)
  ) {
    return {
      success: false,
      error: 'Engine perceptual comparison did not include enough active firework frames.',
    };
  }

  const requiredProductDurationSeconds = finiteNumber(payload.requiredProductDurationSeconds);
  if (
    requiredProductDurationSeconds == null ||
    requiredProductDurationSeconds <= 0 ||
    requiredProductDurationSeconds > reconstruction.durationSeconds + 0.001
  ) {
    return { success: false, error: 'Engine duration evidence does not fit the reconstruction.' };
  }
  if (!Array.isArray(payload.rendererDurations)) {
    return { success: false, error: 'Engine renderer duration evidence is missing.' };
  }
  const rendererDurations = payload.rendererDurations.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const designKey = text(entry.designKey);
    const durationSeconds = finiteNumber(entry.durationSeconds);
    return designKey && durationSeconds != null && durationSeconds > 0 && durationSeconds <= 60
      ? [{ designKey, durationSeconds }]
      : [];
  });
  const expectedDurations = new Map(
    reconstruction.designs.map((entry) => [entry.key, entry.durationSeconds] as const),
  );
  if (
    rendererDurations.length !== payload.rendererDurations.length ||
    rendererDurations.length !== expectedDurations.size ||
    new Set(rendererDurations.map((entry) => entry.designKey)).size !== rendererDurations.length ||
    rendererDurations.some(
      (entry) =>
        !expectedDurations.has(entry.designKey) ||
        Math.abs((expectedDurations.get(entry.designKey) ?? 0) - entry.durationSeconds) > 0.002,
    )
  ) {
    return { success: false, error: 'Engine renderer durations do not match the sealed designs.' };
  }

  if (
    !renderedVideoPath ||
    !/^[0-9a-f-]{36}\/engine-review-[0-9a-f-]{36}-[0-9a-f]{16}\.mp4$/i.test(renderedVideoPath)
  ) {
    return { success: false, error: 'A run-owned engine review video is required to publish.' };
  }
  const reviewArtifact = parseImportEngineReviewArtifact(value, renderedVideoPath);
  if (!reviewArtifact) {
    return {
      success: false,
      error: 'The retained engine review video has no valid immutable integrity evidence.',
    };
  }

  return {
    success: true,
    data: {
      validatorVersion: IMPORT_ENGINE_RENDER_VALIDATOR_VERSION,
      canonicalEvidence: payload,
      metrics,
      reviewArtifact,
      rendererDurations,
      requiredProductDurationSeconds,
      renderedVideoPath,
    },
  };
}

function validationChecks(value: unknown): Array<{ name: string; passed: boolean }> {
  if (!isRecord(value) || !Array.isArray(value.checks)) return [];
  return value.checks.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.passed !== 'boolean') return [];
    const name = text(entry.name) ?? text(entry.label);
    return name ? [{ name, passed: entry.passed }] : [];
  });
}

function titleFromKey(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim();
  return words ? words.replace(/^\w/, (letter) => letter.toUpperCase()) : 'Validation check';
}

function payloadMetadata(payload: unknown) {
  if (!isRecord(payload)) {
    return { model: null, processorVersion: null, prompt: null };
  }
  return {
    model: text(payload.model) ?? text(payload.selectedModel),
    processorVersion: text(payload.processorVersion) ?? text(payload.pipelineVersion),
    prompt: text(payload.refinementPrompt) ?? text(payload.prompt),
  };
}

function findObservedBurstCount(outputs: ImportOutputLike[], runs: ImportRun[]): number | null {
  const candidates = [
    ...runs.flatMap((run) => run.outputs).map((output) => output.payload),
    ...outputs
      .filter((output) => output.outputType === 'frame_analysis')
      .map((output) => output.payload),
  ].reverse();

  for (const payload of candidates) {
    if (!isRecord(payload)) continue;
    const quality = recordAt(payload, 'quality');
    const count = finiteNumber(quality?.burstCount);
    if (count != null) return Math.max(0, Math.round(count));
    if (Array.isArray(payload.bursts)) return payload.bursts.length;
  }
  return null;
}

function legacyAttempts(outputs: ImportOutputLike[]): ImportReviewAttempt[] {
  return outputs.flatMap((output) => {
    if (!['generated_spec', 'draft_spec', 'refinement'].includes(output.outputType)) return [];
    const spec = parseImportedFireworkSpec(output.payload);
    if (!spec) return [];
    const metadata = payloadMetadata(output.payload);
    return [
      {
        id: output.id,
        source: 'legacy_output' as const,
        runId: null,
        attemptNumber: null,
        outputType: output.outputType,
        createdAt: output.createdAt,
        model: metadata.model,
        processorVersion: metadata.processorVersion,
        prompt: metadata.prompt,
        candidateScore: null,
        selected: false,
        approved: false,
        spec,
        reconstruction: spec.reconstruction ?? null,
        reconstructionIssues: [],
        metrics: null,
        engineMetrics: null,
        validation: isRecord(output.payload) ? output.payload.validation : null,
        renderedVideoPath: null,
        renderedVideoUrl: null,
        raw: output.payload,
      },
    ];
  });
}

function candidateAttempts(history: ImportRunHistory): ImportReviewAttempt[] {
  return history.runs.flatMap((run) =>
    run.candidates.map((candidate) => {
      const parsed = parseImportReconstruction(candidate.reconstruction);
      const reconstruction = parsed.success ? parsed.data : null;
      const spec = reconstruction
        ? parseImportedFireworkSpec({ reconstruction: candidate.reconstruction })
        : null;
      const engineMetrics = parseImportEngineMetricSummary(candidate.metrics);
      return {
        id: candidate.id,
        source: 'candidate' as const,
        runId: run.id,
        attemptNumber: run.attemptNumber,
        outputType: 'reconstruction_candidate',
        createdAt: candidate.createdAt,
        model: run.selectedModel,
        processorVersion: run.pipelineVersion,
        prompt: run.requestPrompt,
        candidateScore: candidate.score,
        selected:
          candidate.id === history.selectedCandidateId ||
          Boolean(candidate.selectedAt && run.id === history.activeRunId),
        approved: candidate.id === history.approvedCandidateId || Boolean(candidate.approvedAt),
        spec,
        reconstruction,
        reconstructionIssues: parsed.success ? [] : parsed.issues,
        metrics: candidate.metrics,
        engineMetrics,
        validation: candidate.validation,
        renderedVideoPath: candidate.renderedVideoPath,
        renderedVideoUrl: candidate.renderedVideoUrl,
        raw: candidate.reconstruction,
      };
    }),
  );
}

function buildChecks({
  selected,
  sourceDurationSeconds,
  observedBurstCount,
}: {
  selected: ImportReviewAttempt | null;
  sourceDurationSeconds: number | null;
  observedBurstCount: number | null;
}): ImportReviewCheck[] {
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
  if (selected.reconstruction) {
    checks.push({
      id: 'renderer-schema',
      label: 'Renderer schema',
      status: 'pass',
      detail: 'The candidate uses canonical renderer fields and valid shot references.',
    });
  } else {
    const firstIssue = selected.reconstructionIssues[0];
    checks.push({
      id: 'renderer-schema',
      label: 'Renderer schema',
      status: 'blocker',
      detail: firstIssue
        ? `${firstIssue.path.join('.') || 'candidate'}: ${firstIssue.message}`
        : 'The candidate cannot be parsed as a renderer-native reconstruction.',
    });
  }

  if (selected.source === 'candidate') {
    const validation = isRecord(selected.validation) ? selected.validation : null;
    if (validation?.valid === true) {
      checks.push({
        id: 'worker-validation',
        label: 'Worker validation',
        status: 'pass',
        detail: 'The deterministic worker validation gate passed.',
      });
    } else if (validation?.valid === false) {
      checks.push({
        id: 'worker-validation',
        label: 'Worker validation',
        status: 'blocker',
        detail: 'The selected candidate failed the deterministic worker validation gate.',
      });
    } else {
      checks.push({
        id: 'worker-validation',
        label: 'Worker validation',
        status: 'blocker',
        detail: 'The selected candidate has no confirmed worker validation result.',
      });
    }

    validationChecks(selected.validation).forEach((check, index) => {
      checks.push({
        id: `worker-check-${index}-${check.name}`,
        label: titleFromKey(check.name),
        status: check.passed ? 'pass' : 'blocker',
        detail: check.passed
          ? 'The recorded evidence met this worker threshold.'
          : 'The recorded evidence did not meet this worker threshold.',
      });
    });

    const publicationEvidence = selected.reconstruction
      ? parseImportEnginePublicationEvidence(
          selected.metrics,
          isRunOwnedImportEngineReviewVideoPath(selected.renderedVideoPath, selected.runId)
            ? selected.renderedVideoPath
            : null,
          selected.reconstruction,
        )
      : null;
    if (publicationEvidence?.success) {
      checks.push({
        id: 'engine-frame-validation',
        label: 'Retained sampled engine evidence',
        status: 'pass',
        detail: `${publicationEvidence.data.metrics.engine.frameCount} sampled engine frames passed every publication threshold and produced a retained run-owned review video.`,
      });
    } else {
      checks.push({
        id: 'engine-frame-validation',
        label: 'Retained sampled engine evidence',
        status: 'blocker',
        detail:
          publicationEvidence?.error ??
          'The selected candidate has no valid immutable FireworksEngine render evidence.',
      });
    }
  } else {
    checks.push({
      id: 'legacy-adapter',
      label: 'Legacy reconstruction',
      status: 'warning',
      detail:
        'This draft was adapted from the previous import schema. Run reconstruction again before publishing.',
    });
  }

  const reconstruction = selected.reconstruction;
  if (reconstruction && sourceDurationSeconds != null) {
    const delta = Math.abs(reconstruction.durationSeconds - sourceDurationSeconds);
    const tolerance = Math.max(0.35, sourceDurationSeconds * 0.08);
    checks.push({
      id: 'duration-alignment',
      label: 'Duration alignment',
      status: delta <= tolerance ? 'pass' : 'warning',
      detail:
        delta <= tolerance
          ? `Source and reconstruction differ by ${delta.toFixed(2)} seconds.`
          : `Source and reconstruction differ by ${delta.toFixed(2)} seconds. Review the fade boundary.`,
    });
  }

  if (reconstruction && observedBurstCount != null) {
    const reconstructedShots = reconstruction.shots.length;
    checks.push({
      id: 'burst-count',
      label: 'Observed bursts',
      status: reconstructedShots === observedBurstCount ? 'pass' : 'warning',
      detail:
        reconstructedShots === observedBurstCount
          ? `${reconstructedShots} reconstructed shots match ${observedBurstCount} observed bursts.`
          : `${reconstructedShots} reconstructed shots were produced from ${observedBurstCount} observed bursts.`,
    });
  }

  if (reconstruction) {
    const observedTimingShots = reconstruction.shots.filter(
      (shot) =>
        shot.observedBurstTimeSeconds !== undefined || shot.observedFadeEndSeconds !== undefined,
    ).length;
    checks.push({
      id: 'observed-timing',
      label: 'Launch, burst and fade order',
      status: observedTimingShots > 0 ? 'pass' : 'info',
      detail:
        observedTimingShots > 0
          ? `${observedTimingShots} shot${observedTimingShots === 1 ? '' : 's'} include valid observed timing boundaries.`
          : 'No explicit observed burst or fade boundaries were stored for this candidate.',
    });

    if (reconstruction.observations.unknowns.length > 0) {
      checks.push({
        id: 'unknowns',
        label: 'Unresolved observations',
        status: 'warning',
        detail: reconstruction.observations.unknowns.join(' '),
      });
    }
  }

  const validation = isRecord(selected.validation) ? selected.validation : null;
  const manualReviewFields = Array.isArray(validation?.manualReviewFields)
    ? validation.manualReviewFields.filter((value): value is string => typeof value === 'string')
    : [];
  if (manualReviewFields.length > 0) {
    checks.push({
      id: 'manual-review',
      label: 'Manual review requested',
      status: 'warning',
      detail: manualReviewFields.join(', '),
    });
  }

  return checks;
}

export function buildImportReview({
  outputs,
  history,
  sourceDurationSeconds,
}: {
  outputs: ImportOutputLike[];
  history: ImportRunHistory;
  sourceDurationSeconds: number | null;
}): ImportReview {
  const nativeAttempts = candidateAttempts(history);
  const compatibilityAttempts = legacyAttempts(outputs);
  const attempts = [...nativeAttempts, ...compatibilityAttempts].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
  const selectedAttempt =
    nativeAttempts.find((attempt) => attempt.id === history.selectedCandidateId) ??
    nativeAttempts.find((attempt) => attempt.selected) ??
    nativeAttempts[0] ??
    compatibilityAttempts.at(-1) ??
    null;
  const legacySpec = latestImportedSpecFromOutputs(outputs);
  const latestSpec = selectedAttempt?.spec ?? legacySpec;
  const reconstruction = selectedAttempt?.reconstruction ?? latestSpec?.reconstruction ?? null;
  const observedBurstCount = findObservedBurstCount(outputs, history.runs);
  const checks = buildChecks({
    selected: selectedAttempt,
    sourceDurationSeconds,
    observedBurstCount,
  });

  return {
    attempts,
    selectedAttempt,
    latestSpec,
    reconstruction,
    checks,
    blockers: checks.filter((check) => check.status === 'blocker'),
    warnings: checks.filter((check) => check.status === 'warning'),
    engineMetrics: selectedAttempt?.engineMetrics ?? null,
    engineArtifact: selectedAttempt
      ? parseImportEngineReviewArtifact(selectedAttempt.metrics, selectedAttempt.renderedVideoPath)
      : null,
    modelConfidence: reconstruction?.confidence ?? latestSpec?.confidence ?? null,
    observedBurstCount,
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
