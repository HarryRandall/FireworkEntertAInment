import test from 'node:test';
import assert from 'node:assert/strict';
import { forEachActiveShot, prepareShotSequence } from '../src/view/shot-windows.ts';
import { shotDuration } from '../src/sim/index.ts';
import { effectTemplates } from '../src/templates/index.ts';

const design = effectTemplates.find((entry) => entry.key === 'peony').design;

function active(owner, shots, time) {
  const result = [];
  forEachActiveShot(owner, shots, time, (shot, index, age) => result.push({ shot, index, age }));
  return result;
}

test('cached windows match the original visibility rule in both seek directions and preserve indices', () => {
  const owner = {};
  const shots = [
    { design, t0: 15 },
    { design, t0: 0 },
    { design, t0: 3 },
  ];
  const duration = shotDuration(design);
  assert.equal(prepareShotSequence(owner, shots), 15 + duration);
  for (const time of [0, 3, 15, 15 + duration, 100, 3 + duration, 1, -1, 0]) {
    const expected = shots.flatMap((shot, index) => {
      const age = time - shot.t0;
      return age < 0 || age > duration ? [] : [{ shot, index, age }];
    });
    assert.deepEqual(active(owner, shots, time), expected);
  }
});

test('expired thousands of shots do not resolve their designs again on each frame', () => {
  let reads = 0;
  const shots = Array.from({ length: 3500 }, (_, index) => ({
    t0: index / 100,
    get design() {
      reads += 1;
      return design;
    },
  }));
  const owner = {};
  prepareShotSequence(owner, shots);
  assert.equal(reads, 3500);
  for (const time of [140, 141, 150, 100, 0]) active(owner, shots, time);
  assert.equal(reads, 3500, 'duration resolution belongs to sequence preparation');
});

test('replacement arrays and explicit setShots preparation invalidate old windows', () => {
  const owner = {};
  const shots = [{ design, t0: 0 }];
  assert.equal(active(owner, shots, 0).length, 1);
  const replacement = [{ design, t0: 20 }];
  assert.equal(active(owner, replacement, 0).length, 0);
  assert.equal(active(owner, replacement, 20).length, 1);
  replacement[0].t0 = 30;
  prepareShotSequence(owner, replacement);
  assert.equal(active(owner, replacement, 20).length, 0);
  assert.equal(active(owner, replacement, 30).length, 1);
  assert.equal(prepareShotSequence(owner, []), 0);
  assert.deepEqual(active(owner, [], 0), []);
});
