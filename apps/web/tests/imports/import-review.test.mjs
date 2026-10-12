import assert from 'node:assert/strict';
import { test } from 'node:test';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { buildImportReview, importStageIndex, importStageLabel } =
  await import('../../lib/firework-import/review.ts');
const { reconstruction } = await import('../helpers/import-reconstruction-fixture.mjs');

function fit(overall, shots = 3, extra = {}) {
  return {
    schemaVersion: 'showcrafter.import-fit-evidence.v1',
    rendererVersion: '0.9.1',
    overall,
    shots: Array.from({ length: shots }, (_, index) => ({ index, overall, distances: {} })),
    timedOut: false,
    ...extra,
  };
}

function history({ valid = true, metrics = { source: 'fitted', fit: fit(0.8) }, value } = {}) {
  return {
    activeRunId: 'run-1',
    selectedCandidateId: 'candidate-1',
    approvedRunId: null,
    approvedCandidateId: null,
    runs: [
      {
        id: 'run-1',
        attemptNumber: 1,
        requestKind: 'initial',
        requestPrompt: null,
        status: 'succeeded',
        stage: 'review',
        progress: 100,
        selectedModel: 'test/model',
        videoModel: null,
        pipelineVersion: 'firework-video-fit-v1',
        engineSchemaVersion: 'showcrafter.firework-reconstruction.v2',
        directDispatchStatus: 'accepted',
        directDispatchCallId: null,
        directDispatchAttemptCount: 1,
        directDispatchError: null,
        directDispatchUpdatedAt: null,
        modalCallId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-10-12T00:00:00Z',
        updatedAt: '2026-10-12T00:00:00Z',
        outputs: [],
        candidates: [
          {
            id: 'candidate-1',
            runId: 'run-1',
            ordinal: 0,
            schemaVersion: 'showcrafter.firework-reconstruction.v2',
            reconstruction: value ?? reconstruction(),
            score: 0.8,
            metrics,
            validation: {
              valid,
              validatorVersion: 'showcrafter.firework-reconstruction.v2',
              issues: [],
            },
            selectedAt: '2026-10-12T00:00:00Z',
            approvedAt: null,
            createdAt: '2026-10-12T00:00:00Z',
          },
        ],
      },
    ],
  };
}

test('a fitted, validated candidate has no publish blockers', () => {
  const review = buildImportReview({ history: history(), sourceDurationSeconds: 10 });
  assert.equal(review.selectedAttempt.id, 'candidate-1');
  assert.equal(review.blockers.length, 0);
  assert.equal(review.fit.overall, 0.8);
  assert.equal(review.checks.find((check) => check.id === 'fit-evidence').status, 'pass');
});

test('a weak or timed-out fit warns but leaves publishing to the admin', () => {
  const review = buildImportReview({
    history: history({ metrics: { source: 'fitted', fit: fit(0.3, 3, { timedOut: true }) } }),
    sourceDurationSeconds: 10,
  });
  assert.equal(review.blockers.length, 0);
  assert.deepEqual(
    review.warnings.map((check) => check.id),
    ['fit-evidence', 'fit-timeout'],
  );
});

test('missing fit evidence, failed validation and old candidates are blockers', () => {
  const noFit = buildImportReview({ history: history({ metrics: {} }), sourceDurationSeconds: 10 });
  assert.ok(noFit.blockers.some((check) => check.id === 'fit-evidence'));

  const shortFit = buildImportReview({
    history: history({ metrics: { source: 'fitted', fit: fit(0.8, 2) } }),
    sourceDurationSeconds: 10,
  });
  assert.ok(shortFit.blockers.some((check) => check.id === 'fit-evidence'));

  const invalid = buildImportReview({
    history: history({ valid: false }),
    sourceDurationSeconds: 10,
  });
  assert.ok(invalid.blockers.some((check) => check.id === 'worker-validation'));

  const legacy = buildImportReview({
    history: history({ value: { version: 1, designs: [], shots: [] } }),
    sourceDurationSeconds: 10,
  });
  assert.ok(legacy.blockers.some((check) => check.id === 'renderer-schema'));
  assert.equal(legacy.reconstruction, null);
});

test('stage helpers map durable run stages to the visible workbench', () => {
  assert.equal(importStageIndex('processing', 'video_analysis'), 1);
  assert.equal(importStageIndex('processing', 'model'), 2);
  assert.equal(importStageIndex('processing', 'render'), 2);
  assert.equal(importStageIndex('needs_review', 'review'), 4);
  assert.equal(importStageLabel('complete', 'review'), 'Publish');
});
