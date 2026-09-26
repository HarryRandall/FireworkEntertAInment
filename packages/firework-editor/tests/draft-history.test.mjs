import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DraftHistory } from '../src/draft-history.ts';

test('a live gesture is one undo step and can be cancelled', () => {
  const h = new DraftHistory({ glow: 1 }, '1');
  h.begin('Adjust glow');
  for (let i = 2; i <= 100; i++) h.observe({ glow: i }, String(i));
  h.commit();
  assert.deepEqual(h.undo(), { glow: 1 });
  assert.equal(h.canUndo, false);
  assert.deepEqual(h.redo(), { glow: 100 });
  h.begin();
  h.observe({ glow: 200 }, '200');
  assert.deepEqual(h.cancel(), { glow: 100 });
});

test('preset replacement is atomic and new edits discard redo', () => {
  const h = new DraftHistory({ outer: 1, inner: 2 }, 'initial');
  h.observe({ outer: 20, inner: 2 }, 'preset', 'Apply trail preset');
  assert.deepEqual(h.undo(), { outer: 1, inner: 2 });
  h.observe({ outer: 3, inner: 2 }, 'new');
  assert.equal(h.canRedo, false);
});

test('history is bounded and snapshots cannot be mutated by callers', () => {
  const h = new DraftHistory({ x: 0 }, '0', 2);
  for (let x = 1; x <= 4; x++) h.observe({ x }, String(x));
  const snapshot = h.undo();
  snapshot.x = 99;
  assert.deepEqual(h.undo(), { x: 2 });
  assert.equal(h.undo(), null);
  assert.deepEqual(h.redo(), { x: 3 });
});

test('cancelled and no-op gestures preserve the redo history', () => {
  for (const end of ['cancel', 'commit']) {
    const history = new DraftHistory(1, '1');
    history.observe(2, '2');
    history.undo();
    history.begin();
    history.observe(3, '3');
    if (end === 'commit') history.observe(1, '1');
    history[end]();
    assert.equal(history.canUndo, false);
    assert.equal(history.redo(), 2);
  }
});
