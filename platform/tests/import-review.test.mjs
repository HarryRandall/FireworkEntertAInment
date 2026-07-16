import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('@/')) {
        return nextResolve(
          pathToFileURL(`${join(process.cwd(), specifier.slice(2))}.ts`).href,
          context,
        );
      }
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  buildImportReview,
  importStageIndex,
  importStageLabel,
  isRunOwnedImportEngineReviewVideoPath,
  parseImportEngineMetricSummary,
  parseImportEnginePublicationEvidence,
  parseImportEngineReviewArtifact,
} = await import('../lib/import-review.ts');
const { DEFAULT_DESIGN, estimateDesignDurationSeconds } =
  await import('../lib/fireworks/design.ts');
const { FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION } =
  await import('../lib/fireworks/import-renderer-contract.ts');

const rendererDuration = Math.ceil(estimateDesignDurationSeconds(DEFAULT_DESIGN) * 1_000) / 1_000;
const RUN_ID = '019f6471-87ef-7dc1-a23b-9cf086945402';
const REVIEW_VIDEO_PATH =
  '019f6471-87ef-7dc1-a23b-9cf086945401/engine-review-019f6471-87ef-7dc1-a23b-9cf086945402-aabbccddeeff0011.mp4';

function engineMetrics(priorityIssues = []) {
  return {
    schemaVersion: 'showcrafter.engine-render-metrics.v2',
    engine: {
      renderer: 'FireworksEngine',
      rendererVersion: FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
      camera: 'FireworkReplayCanvas.default',
      frameWidth: 960,
      frameHeight: 540,
      frameCount: 32,
      fixedStepSeconds: 1 / 60,
    },
    timing: { score: 0.94, onsetDeltaSeconds: 0.03, peakDeltaSeconds: 0.04 },
    trajectory: {
      score: 0.91,
      centroidRmseNormalised: 0.02,
      spreadMae: 0.03,
      comparedFrameCount: 32,
    },
    palette: { score: 0.92, perceptualDistance: 0.08 },
    fade: {
      score: 0.9,
      normalisedCurveMae: 0.05,
      fadeEndDeltaSeconds: 0.04,
      comparedFrameCount: 32,
    },
    perceptual: {
      score: 0.89,
      meanForegroundSsim: 0.91,
      meanLumaMae: 0.04,
      comparedFrameCount: 32,
      activeFrameCount: 18,
      foregroundWeightTotal: 2.4,
    },
    overallScore: 0.912,
    priorityIssues,
  };
}

function reconstruction() {
  return {
    version: 1,
    source: 'video_inferred',
    name: 'Red peony',
    description: 'Silver lift to red peony.',
    durationSeconds: rendererDuration,
    heightMeters: 45,
    caliber: '30mm',
    confidence: 0.87,
    designs: [
      {
        key: 'red-peony',
        effectSlug: 'peony',
        label: 'Red peony',
        durationSeconds: rendererDuration,
        heightMeters: 45,
        caliber: '30mm',
        confidence: 0.86,
        colorPalette: ['#ff2d55'],
        design: structuredClone(DEFAULT_DESIGN),
      },
    ],
    shots: [
      {
        designKey: 'red-peony',
        timeOffsetSeconds: 0,
        observedBurstTimeSeconds: 1.2,
        observedFadeEndSeconds: rendererDuration - 0.1,
        position: { x: 0, y: 0, z: 0 },
        launchPositionIndex: 1,
        panDegrees: 0,
        tiltDegrees: 0,
        seed: 101,
        scale: 1,
      },
    ],
    observations: {
      observedEvents: [{ timeSeconds: 1.2, type: 'burst', confidence: 0.91 }],
      fieldConfidence: { timing: 0.9 },
      unknowns: [],
    },
  };
}

function history(
  validation = { valid: true, checks: [] },
  metrics = {
    engineRender: {
      schemaVersion: 'showcrafter.import-render-result.v1',
      harnessVersion: 'showcrafter.import-render-harness.v1',
      rendererVersion: FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
      metrics: engineMetrics(),
      rendererDurations: [{ designKey: 'red-peony', durationSeconds: rendererDuration }],
      requiredProductDurationSeconds: rendererDuration,
      reviewArtifact: {
        storagePath: REVIEW_VIDEO_PATH,
        sha256: 'a'.repeat(64),
        byteSize: 123_456,
        storageETag: 'b'.repeat(32),
      },
    },
  },
) {
  return {
    activeRunId: RUN_ID,
    selectedCandidateId: 'candidate-1',
    approvedRunId: null,
    approvedCandidateId: null,
    runs: [
      {
        id: RUN_ID,
        attemptNumber: 1,
        requestKind: 'initial',
        requestPrompt: null,
        status: 'succeeded',
        stage: 'review',
        progress: 100,
        selectedModel: 'openai/gpt-5.4',
        videoModel: null,
        pipelineVersion: 'firework-reconstruction-v4',
        engineSchemaVersion: 'showcrafter.firework-design.v1',
        errorMessage: null,
        startedAt: '2026-07-15T00:00:00.000Z',
        completedAt: '2026-07-15T00:01:00.000Z',
        createdAt: '2026-07-15T00:00:00.000Z',
        updatedAt: '2026-07-15T00:01:00.000Z',
        outputs: [
          {
            id: 'output-1',
            runId: RUN_ID,
            stage: 'video_observations',
            sequence: 1,
            outputType: 'video_observations',
            schemaVersion: 'v1',
            payload: { quality: { burstCount: 1 } },
            createdAt: '2026-07-15T00:00:10.000Z',
          },
        ],
        candidates: [
          {
            id: 'candidate-1',
            runId: RUN_ID,
            ordinal: 0,
            schemaVersion: 'showcrafter.firework-reconstruction.v1',
            reconstruction: reconstruction(),
            score: 0.82,
            metrics,
            validation,
            renderedVideoPath: REVIEW_VIDEO_PATH,
            renderedVideoUrl: 'https://example.test/retained-evidence.mp4?token=short-lived',
            selectedAt: '2026-07-15T00:01:00.000Z',
            approvedAt: null,
            createdAt: '2026-07-15T00:01:00.000Z',
          },
        ],
      },
    ],
  };
}

test('review keeps model confidence separate from deterministic publish blockers', () => {
  const review = buildImportReview({
    outputs: [],
    history: history(),
    sourceDurationSeconds: rendererDuration + 0.1,
  });

  assert.equal(review.selectedAttempt.id, 'candidate-1');
  assert.equal(review.modelConfidence, 0.87);
  assert.equal(review.observedBurstCount, 1);
  assert.equal(review.blockers.length, 0);
  assert.equal(review.engineMetrics.overallScore, 0.912);
  assert.equal(review.engineArtifact.sha256, 'a'.repeat(64));
  assert.equal(
    review.checks.some((check) => check.id === 'renderer-schema'),
    true,
  );
  assert.equal(
    review.checks.some((check) => check.id === 'burst-count'),
    true,
  );
});

test('worker validation failure remains an explicit blocker', () => {
  const review = buildImportReview({
    outputs: [],
    history: history({
      valid: false,
      checks: [{ name: 'duration_alignment', passed: false, score: 0.4 }],
    }),
    sourceDurationSeconds: rendererDuration,
  });

  assert.equal(
    review.blockers.some((check) => check.id === 'worker-validation'),
    true,
  );
  assert.equal(
    review.blockers.some((check) => check.label === 'Duration alignment'),
    true,
  );
});

test('review accepts only exact immutable engine metric structure and keeps priorities', () => {
  const issue = {
    field: 'fade',
    score: 0.62,
    instruction: 'Increase visible trail persistence.',
  };
  const parsed = parseImportEngineMetricSummary({
    engineRender: { metrics: engineMetrics([issue]) },
  });
  assert.equal(parsed.overallScore, 0.912);
  assert.deepEqual(parsed.priorityIssues, [issue]);
  assert.equal(
    parseImportEngineMetricSummary({
      engineRender: {
        metrics: {
          ...engineMetrics(),
          engine: { ...engineMetrics().engine, renderer: 'PythonProxy' },
        },
      },
    }),
    null,
  );
});

test('publication evidence requires complete engine scores, durations, and a run-owned review video', () => {
  const plan = reconstruction();
  const candidate = history().runs[0].candidates[0];
  const parsed = parseImportEnginePublicationEvidence(
    candidate.metrics,
    candidate.renderedVideoPath,
    plan,
  );
  assert.equal(parsed.success, true);

  const weak = history(undefined, {
    engineRender: {
      schemaVersion: 'showcrafter.import-render-result.v1',
      harnessVersion: 'showcrafter.import-render-harness.v1',
      rendererVersion: FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
      metrics: { ...engineMetrics(), overallScore: 0.77 },
      rendererDurations: [{ designKey: 'red-peony', durationSeconds: rendererDuration }],
      requiredProductDurationSeconds: rendererDuration,
      reviewArtifact: {
        storagePath: REVIEW_VIDEO_PATH,
        sha256: 'a'.repeat(64),
        byteSize: 123_456,
        storageETag: 'b'.repeat(32),
      },
    },
  }).runs[0].candidates[0];
  assert.equal(
    parseImportEnginePublicationEvidence(weak.metrics, weak.renderedVideoPath, plan).success,
    false,
  );
  assert.equal(parseImportEnginePublicationEvidence(candidate.metrics, null, plan).success, false);
  assert.equal(
    parseImportEngineReviewArtifact(
      {
        ...candidate.metrics,
        engineRender: {
          ...candidate.metrics.engineRender,
          reviewArtifact: {
            ...candidate.metrics.engineRender.reviewArtifact,
            sha256: 'tampered',
          },
        },
      },
      candidate.renderedVideoPath,
    ),
    null,
  );

  for (const invalidEnvelope of [
    {
      ...candidate.metrics,
      engineRender: { ...candidate.metrics.engineRender, schemaVersion: 'legacy-result' },
    },
    {
      ...candidate.metrics,
      engineRender: { ...candidate.metrics.engineRender, harnessVersion: 'legacy-harness' },
    },
    {
      ...candidate.metrics,
      engineRender: {
        ...candidate.metrics.engineRender,
        metrics: {
          ...candidate.metrics.engineRender.metrics,
          engine: { ...candidate.metrics.engineRender.metrics.engine, frameWidth: 32 },
        },
      },
    },
  ]) {
    assert.equal(
      parseImportEnginePublicationEvidence(invalidEnvelope, candidate.renderedVideoPath, plan)
        .success,
      false,
    );
  }

  const detachedMetrics = {
    ...candidate.metrics.engineRender.metrics,
    engineRender: {
      ...candidate.metrics.engineRender,
      metrics: undefined,
    },
  };
  assert.equal(
    parseImportEnginePublicationEvidence(detachedMetrics, candidate.renderedVideoPath, plan)
      .success,
    false,
  );
});

test('retained engine evidence path is bound to the candidate run', () => {
  const candidate = history().runs[0].candidates[0];
  assert.equal(isRunOwnedImportEngineReviewVideoPath(candidate.renderedVideoPath, RUN_ID), true);
  assert.equal(
    isRunOwnedImportEngineReviewVideoPath(
      candidate.renderedVideoPath,
      '019f6471-87ef-7dc1-a23b-9cf086945499',
    ),
    false,
  );
  assert.equal(
    isRunOwnedImportEngineReviewVideoPath('unrelated/object.mp4', candidate.runId),
    false,
  );
});

test('stage helpers map durable run stages to the visible workbench', () => {
  assert.equal(importStageIndex('processing', 'frame_observations'), 1);
  assert.equal(importStageIndex('processing', 'candidate_synthesis'), 2);
  assert.equal(importStageIndex('needs_review', 'review'), 4);
  assert.equal(importStageLabel('complete', 'review'), 'Publish');
});
