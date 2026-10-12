import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { spreadMultishotPositions } = await import('../../lib/cue-generation/multishot-spread.ts');

const products = new Map([
  ['cake', { shotCount: 12 }],
  ['shell', { shotCount: 1 }],
]);
const cue = (timeSeconds, tube, productId = 'cake') => ({ timeSeconds, tube, productId });

test('multishots cued on one position spread across the site in time order', () => {
  const spread = spreadMultishotPositions(
    [cue(10, 1), cue(20, 1), cue(30, 1), cue(40, 1)],
    products,
    3,
  );
  assert.deepEqual(
    spread.map((entry) => entry.tube),
    [1, 0, 2, 1],
  );
});

test('a multishot keeps its position when the emptier one is busy, and single shells never move', () => {
  const spread = spreadMultishotPositions(
    [cue(10, 1), cue(20, 1), cue(20.2, 0, 'shell'), cue(20.3, 2, 'shell')],
    products,
    3,
  );
  assert.deepEqual(
    spread.map((entry) => entry.tube),
    [1, 1, 0, 2],
  );
  assert.deepEqual(
    spreadMultishotPositions([cue(10, 0), cue(20, 0)], products, 1).map((entry) => entry.tube),
    [0, 0],
  );
});

test('the runner spreads multishots before its final timeline safety pass', () => {
  const runner = readFileSync('lib/cue-generation/runner.server.ts', 'utf8');
  assert.match(runner, /spreadMultishotPositions\(cues, productById, maxTubes\)/);
});
