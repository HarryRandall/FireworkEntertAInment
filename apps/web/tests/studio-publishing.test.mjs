/** Design differences and queue behaviour are tested without WebGL or external transport. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates, RENDERER_VERSION } from '@showcrafter/fireworks';
import { designChanges } from '../lib/studio/diff.ts';
import { POSTER_SPECS, needsPosters } from '../lib/studio/poster-specs.ts';
import { runPosterQueue } from '../lib/studio/poster-queue.ts';
const document = effectTemplates.find((entry) => entry.design.kind === 'shell').design;
test('unchanged designs have no diff and small numeric changes are retained', () => {
  assert.deepEqual(designChanges(document, structuredClone(document)), []);
  const after = structuredClone(document);
  after.launch.height_m += 0.000001;
  const changes = designChanges(document, after);
  assert.equal(changes.length, 1);
  assert.match(changes[0].label, /launch › height m/);
});
test('diff includes all changes, object removals, layer identities and order', () => {
  const before = structuredClone(document);
  const layer = structuredClone(before.breaks[0].layers[0]);
  layer.id = 'other';
  layer.name = 'Other';
  before.breaks[0].layers.push(layer);
  const after = structuredClone(before);
  after.breaks[0].layers.reverse();
  after.breaks[0].layers[0].name = 'Renamed';
  after.adjustments = { 'launch.height': 1 };
  after.seed += 1;
  const changes = designChanges(before, after);
  assert.ok(changes.some((change) => change.key === 'breaks.0.layers.order'));
  assert.ok(changes.some((change) => change.key === 'breaks.0.layers.other.name'));
  assert.ok(changes.some((change) => change.key === 'adjustments.launch.height'));
  assert.ok(changes.some((change) => change.key === 'seed'));
  assert.equal(changes.filter((change) => change.key.endsWith('radius_m')).length, 0);
  const removed = structuredClone(after);
  removed.breaks[0].layers = removed.breaks[0].layers.filter((item) => item.id !== 'other');
  assert.ok(
    designChanges(after, removed).some(
      (change) => change.key === 'breaks.0.layers.other.name' && change.to === 'None',
    ),
  );
  assert.ok(designChanges(null, document).length > 12);
});
test('stale, partial and failed poster sets require a retry', () => {
  const ready = POSTER_SPECS.map((spec) => ({
    framing: spec.framing,
    renderer: RENDERER_VERSION,
    status: 'ready',
  }));
  assert.equal(needsPosters(ready), false);
  assert.equal(needsPosters(ready.slice(1)), true);
  assert.equal(needsPosters(ready.map((row) => ({ ...row, renderer: 'older' }))), true);
  assert.equal(needsPosters(ready.map((row) => ({ ...row, status: 'failed' }))), true);
});
test('queue is sequential, continues after failures and reports each version', async () => {
  const tasks = ['one', 'two', 'three'].map((id) => ({ id }));
  const outcomes = [];
  let active = 0;
  await runPosterQueue(
    tasks,
    async (task) => {
      active += 1;
      assert.equal(active, 1);
      await Promise.resolve();
      active -= 1;
      if (task.id === 'two') throw new Error('Upload refused');
    },
    (outcome) => outcomes.push(outcome),
    () => false,
  );
  assert.deepEqual(
    outcomes.map((outcome) => outcome.status),
    ['ready', 'failed', 'ready'],
  );
  assert.equal(outcomes[1].message, 'Upload refused');
});
test('queue cancellation stops between versions and suppresses stale outcomes', async () => {
  let cancelled = false;
  const visited = [];
  const outcomes = [];
  await runPosterQueue(
    [{ id: 'one' }, { id: 'two' }],
    async (task) => {
      visited.push(task.id);
      cancelled = true;
    },
    (outcome) => outcomes.push(outcome),
    () => cancelled,
  );
  assert.deepEqual(visited, ['one']);
  assert.deepEqual(outcomes, []);
});
