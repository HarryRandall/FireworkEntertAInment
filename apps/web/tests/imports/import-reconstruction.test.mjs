import assert from 'node:assert/strict';
import { test } from 'node:test';
await import('../../../../scripts/renderer/register-typescript.mjs');
const {
  IMPORT_RECONSTRUCTION_VALIDATOR_VERSION,
  parseImportCandidateMetrics,
  parseImportReconstruction,
  reconstructionToReplayCues,
} = await import('../../lib/firework-import/reconstruction.ts');
const { reconstruction } = await import('../helpers/import-reconstruction-fixture.mjs');

test('the validator version matches the database and worker contract', () => {
  assert.equal(IMPORT_RECONSTRUCTION_VALIDATOR_VERSION, 'showcrafter.firework-reconstruction.v2');
});

test('a version 2 reconstruction parses with renderer-validated designs', () => {
  const parsed = parseImportReconstruction(reconstruction());
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.designs[0].design.kind, 'shell');
  assert.equal(parsed.data.shots.length, 3);
});

test('replay cues follow shot time and carry pan and the renderer design', () => {
  const parsed = parseImportReconstruction(reconstruction());
  const cues = reconstructionToReplayCues(parsed.data, { idPrefix: 'review' });
  assert.deepEqual(
    cues.map((cue) => [cue.timeSeconds, cue.productId, cue.shotPanDegrees]),
    [
      [0, 'review-a', 0],
      [1.5, 'review-a', 8],
      [3, 'review-b', -12],
    ],
  );
  assert.equal(cues[2].firework.design.kind, 'shell');
  assert.equal(cues[2].firework.name, 'Willow');
  assert.equal(cues[2].launchPositionIndex, 0);
});

test('old version 1 candidates, invalid designs and broken references are rejected', () => {
  assert.equal(parseImportReconstruction({ ...reconstruction(), version: 1 }).success, false);

  const broken = reconstruction();
  broken.designs[0] = { ...broken.designs[0], design: { kind: 'shell', nonsense: true } };
  const invalidDesign = parseImportReconstruction(broken);
  assert.equal(invalidDesign.success, false);
  assert.deepEqual(invalidDesign.issues[0].path, ['designs', 0, 'design']);

  const unknown = reconstruction();
  unknown.shots[0] = { ...unknown.shots[0], designKey: 'z' };
  assert.match(parseImportReconstruction(unknown).issues[0].message, /unknown design z/);

  const late = reconstruction({ durationSeconds: 8 });
  assert.match(parseImportReconstruction(late).issues[0].message, /ends after/);

  const unused = reconstruction();
  unused.shots = unused.shots.filter((shot) => shot.designKey === 'a');
  unused.durationSeconds = 6;
  assert.match(parseImportReconstruction(unused).issues[0].message, /not used/);

  const pan = reconstruction();
  pan.shots[0] = { ...pan.shots[0], panDegrees: 45 };
  assert.equal(parseImportReconstruction(pan).success, false);
});

test('candidate metrics require the fit evidence schema', () => {
  const metrics = {
    source: 'fitted',
    fit: {
      schemaVersion: 'showcrafter.import-fit-evidence.v1',
      rendererVersion: '0.9.1',
      overall: 0.71,
      shots: [{ index: 0, overall: 0.7, distances: { timing: 0.1, colour: null } }],
      timedOut: false,
      iterations: { a: 3 },
      initialOverall: 0.5,
    },
  };
  assert.equal(parseImportCandidateMetrics(metrics).fit.overall, 0.71);
  assert.equal(parseImportCandidateMetrics({ overallScore: 0.9 }), null);
  assert.equal(
    parseImportCandidateMetrics({ ...metrics, fit: { ...metrics.fit, schemaVersion: 'other' } }),
    null,
  );
});
