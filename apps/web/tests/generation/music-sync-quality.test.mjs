import assert from 'node:assert/strict';
import { test } from 'node:test';

await import('../../../../scripts/renderer/register-typescript.mjs');
const { evaluateMusicSync } = await import('../../lib/cue-generation/music-sync-quality.ts');

function assess(offsets, regularityScore) {
  const profile = {
    completeness: 'complete',
    firstImpactOffsetSeconds: offsets[0],
    shots: offsets.map((impactOffsetSeconds) => ({ impactOffsetSeconds })),
    intervals: offsets.length < 3 ? null : { count: offsets.length - 1, regularityScore },
  };
  return evaluateMusicSync({
    cues: [{ productId: 'effect', slotIndex: 0, timeSeconds: 9, impactTimeSeconds: 10 }],
    slots: [{ index: 0, time: 10 }],
    analysis: { beat_times: [9, 9.5, 10, 10.5, 11, 11.5, 12], tempo_bpm: 120 },
    timingProfiles: new Map([['effect', { normal: profile }]]),
  });
}

test('a single visible burst can be assessed without inventing a cake cadence', () => {
  const sync = assess([1], null);
  assert.equal(sync.score, 100);
  assert.equal(sync.cadenceScore, null);
});

test('an irregular cake rhythm cannot report perfect sync just because its first burst is aligned', () => {
  const sync = assess([1, 1.1, 2.3, 3.7], 0.2);
  assert.equal(sync.anchorAccuracy, 1);
  assert.ok(sync.cadenceScore != null && sync.cadenceScore < 0.5);
  assert.ok(sync.score < 90);
});

test('a regular cake matched to the beat retains its cadence evidence', () => {
  const sync = assess([1, 1.5, 2, 2.5], 1);
  assert.equal(sync.cadenceScore, 1);
  assert.equal(sync.score, 100);
});
