import assert from 'node:assert/strict';
import test from 'node:test';

const refinement = await import('../../lib/shows/refinement.ts');

test('refinement intent keeps destructive requests out of the add-only transaction', () => {
  assert.equal(refinement.parseRefinementIntent('add gold at 1:20'), 'add');
  assert.equal(refinement.parseRefinementIntent('remove the blue ones at the end'), 'remove');
  assert.equal(refinement.parseRefinementIntent('move this to the chorus'), 'move');
  assert.equal(refinement.parseRefinementIntent('replace the finale'), 'replace');
});

test('refinement time accepts start and clock references within the show boundary', () => {
  assert.equal(refinement.parseRefinementTime('add green at the start', 90), 0.5);
  assert.equal(refinement.parseRefinementTime('something gold at 1:20', 90), 80);
  assert.equal(refinement.parseRefinementTime('at 2:30', 90), 90);
  assert.equal(refinement.parseRefinementTime('add a comet', 90), null);
});

test('model proposals must be additions for listed products and use a valid tube', () => {
  const productId = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(
    refinement.validateRefinementProposal(
      { intent: 'add', productId, timeSeconds: 120, launchPositionIndex: 1, emphasis: 'peak' },
      new Set([productId]),
      90,
    ),
    { intent: 'add', productId, timeSeconds: 90, launchPositionIndex: 1, emphasis: 'peak' },
  );
  assert.equal(
    refinement.validateRefinementProposal(
      { intent: 'remove', productId, timeSeconds: 1, launchPositionIndex: 1 },
      new Set([productId]),
      90,
    ),
    null,
  );
  assert.equal(
    refinement.validateRefinementProposal(
      { intent: 'add', productId, timeSeconds: 1, launchPositionIndex: 4 },
      new Set([productId]),
      90,
    ),
    null,
  );
});

test('model response parsing accepts structured JSON without trusting arbitrary text', () => {
  assert.deepEqual(refinement.parseRefinementModelReply('```json\n{"intent":"add"}\n```'), {
    intent: 'add',
  });
  assert.equal(refinement.parseRefinementModelReply('not JSON'), null);
});
