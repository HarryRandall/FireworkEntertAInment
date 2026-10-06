/** Rolling frame cadence statistics stay bounded and reset independently of playback time. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameTimes } from '../src/view/frame-times.ts';

test('rolling frame intervals report a bounded median and nearest-rank p95', () => {
  const timing = new FrameTimes();
  assert.deepEqual(timing.summary(), { medianMs: 0, p95Ms: 0, samples: 0, window: 120 });
  for (let index = 1; index <= 200; index++) timing.record(index);
  assert.deepEqual(timing.summary(), { medianMs: 140.5, p95Ms: 194, samples: 120, window: 120 });
  timing.record(NaN);
  timing.record(0);
  timing.record(-1);
  assert.equal(timing.summary().samples, 120);
  timing.reset();
  timing.record(16);
  assert.equal(timing.summary().medianMs, 16);
});
