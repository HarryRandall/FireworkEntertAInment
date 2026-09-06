import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return nextResolve('data:text/javascript,export {};', context);
    const unresolved = specifier.startsWith('@/')
      ? join(process.cwd(), specifier.slice(2))
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        ? join(dirname(fileURLToPath(context.parentURL)), specifier)
        : null;
    if (unresolved) {
      for (const candidate of [unresolved, `${unresolved}.ts`, `${unresolved}.tsx`]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { evaluateMusicSync } = await import('../../lib/cue-generation/music-sync-quality.ts');

function slot(index, time) {
  return {
    index,
    time,
    tube: 0,
    intensity: 0.5,
    sectionLabel: 'verse',
    vibe: 'verse',
    nearClimax: false,
    isDownbeat: false,
    barPosition: 1,
    emphasis: 'normal',
    finale: false,
  };
}

function profile({ id = 'p', impacts = [0.5], completeness = 'complete' } = {}) {
  const intervals = impacts.slice(1).map((value, index) => value - impacts[index]);
  return {
    productId: id,
    shotCount: impacts.length,
    resolvedShotCount: impacts.length,
    source: 'renderer_estimate',
    completeness,
    shots: impacts.map((impactOffsetSeconds) => ({
      productId: id,
      launchOffsetSeconds: 0,
      impactOffsetSeconds,
      endOffsetSeconds: impactOffsetSeconds + 1,
    })),
    firstImpactOffsetSeconds: completeness === 'complete' ? impacts[0] : null,
    lastImpactOffsetSeconds: completeness === 'complete' ? impacts.at(-1) : null,
    totalDurationSeconds: completeness === 'complete' ? impacts.at(-1) + 1 : null,
    intervals: intervals.length
      ? {
          count: intervals.length,
          minSeconds: Math.min(...intervals),
          maxSeconds: Math.max(...intervals),
          meanSeconds: intervals.reduce((a, b) => a + b, 0) / intervals.length,
          medianSeconds: intervals[Math.floor(intervals.length / 2)],
          regularityScore:
            intervals.length > 1
              ? Math.max(
                  0,
                  1 -
                    (Math.max(...intervals) - Math.min(...intervals)) /
                      (intervals.reduce((a, b) => a + b, 0) / intervals.length),
                )
              : null,
        }
      : null,
  };
}

function profiles(id, p) {
  return new Map([[id, { normal: p, accent: p, peak: p }]]);
}

test('scores an accurate and a late direct impact using launch plus first impact', () => {
  const timingProfiles = profiles('direct', profile());
  const accurate = evaluateMusicSync({
    cues: [{ productId: 'direct', slotIndex: 0, impactTimeSeconds: 10, timeSeconds: 9.5 }],
    slots: [slot(0, 10)],
    timingProfiles,
  });
  const late = evaluateMusicSync({
    cues: [{ productId: 'direct', slotIndex: 0, impactTimeSeconds: 10, timeSeconds: 9.7 }],
    slots: [slot(0, 10)],
    timingProfiles,
  });
  assert.equal(accurate.anchorAccuracy, 1);
  assert.equal(late.anchorAccuracy, 0);
  assert.equal(accurate.score, 100);
});

test('uses the passed profile and does not invent evidence for unknown or invalid slots', () => {
  const result = evaluateMusicSync({
    cues: [
      { productId: 'direct', slotIndex: 0, impactTimeSeconds: 10, timeSeconds: 9.5 },
      { productId: 'missing', slotIndex: 0, impactTimeSeconds: 10, timeSeconds: 9.5 },
      { productId: 'direct', slotIndex: 9, impactTimeSeconds: 10, timeSeconds: 9.5 },
    ],
    slots: [slot(0, 10)],
    timingProfiles: profiles('direct', profile({ impacts: [0.5] })),
  });
  assert.equal(result.assessedCueCount, 1);
  assert.equal(result.totalCueCount, 3);
});

test('cadence rewards regular matching intervals and penalises mismatch', () => {
  const matching = evaluateMusicSync({
    cues: [{ productId: 'cake', slotIndex: 0, impactTimeSeconds: 10, timeSeconds: 10 }],
    slots: [slot(0, 10)],
    analysis: { beat_times: [9, 9.5, 10, 10.5], tempo_bpm: 120 },
    timingProfiles: profiles('cake', profile({ impacts: [0, 0.5, 1, 1.5] })),
  });
  const mismatch = evaluateMusicSync({
    cues: [{ productId: 'cake', slotIndex: 0, impactTimeSeconds: 10, timeSeconds: 10 }],
    slots: [slot(0, 10)],
    analysis: { beat_times: [9, 9.5, 10, 10.5], tempo_bpm: 120 },
    timingProfiles: profiles('cake', profile({ impacts: [0, 0.73, 1.46, 2.19] })),
  });
  assert.ok(matching.cadenceScore > mismatch.cadenceScore);
});

test('sustained and irregular sequences are assessed once at anchor, not once per shot', () => {
  const result = evaluateMusicSync({
    cues: [{ productId: 'cake', slotIndex: 0, impactTimeSeconds: 10, timeSeconds: 10 }],
    slots: [slot(0, 10)],
    analysis: { beat_times: [9, 9.5, 10, 10.5], tempo_bpm: 120 },
    timingProfiles: profiles('cake', profile({ impacts: [0, 0.2, 1, 1.8] })),
  });
  assert.equal(result.assessedCueCount, 1);
  assert.equal(result.cadenceScore, null);
  assert.equal(result.score, 100);
});

test('unknown timing or analysis yields nullable timing components and deterministic finite output', () => {
  const input = {
    cues: [{ productId: 'unknown', slotIndex: 0, impactTimeSeconds: 10, timeSeconds: 9 }],
    slots: [slot(0, 10)],
    analysis: null,
    timingProfiles: new Map(),
  };
  const first = evaluateMusicSync(input);
  const second = evaluateMusicSync(input);
  assert.deepEqual(first, second);
  assert.equal(first.score, null);
  assert.equal(first.anchorAccuracy, null);
  assert.equal(first.cadenceScore, null);
  assert.ok(Object.values(first).every((value) => value === null || Number.isFinite(value)));
});

test('a declared multishot anchor without an actual launch timestamp is not timing evidence', () => {
  const result = evaluateMusicSync({
    cues: [{ productId: 'cake', slotIndex: 0, impactTimeSeconds: 10 }],
    slots: [slot(0, 10)],
    timingProfiles: profiles('cake', profile({ impacts: [0, 0.5, 1] })),
  });
  assert.equal(result.score, null);
  assert.equal(result.assessedCueCount, 0);
});
