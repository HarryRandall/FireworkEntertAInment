import assert from 'node:assert/strict';
import { test } from 'node:test';

const { cadenceCompatibility, localBeatIntervalSeconds, musicTimingPreference } =
  await import('../../lib/cue-generation/music-product-matching.ts');

function profile(intervals, overrides = {}) {
  const shots = [{ impactOffsetSeconds: 0 }];
  for (const interval of intervals) {
    shots.push({ impactOffsetSeconds: shots.at(-1).impactOffsetSeconds + interval });
  }
  return {
    productId: 'product',
    shotCount: shots.length,
    resolvedShotCount: shots.length,
    source: 'renderer_estimate',
    completeness: 'complete',
    shots,
    firstImpactOffsetSeconds: 0,
    lastImpactOffsetSeconds: shots.at(-1).impactOffsetSeconds,
    totalDurationSeconds: shots.at(-1).impactOffsetSeconds + 1,
    intervals: {
      count: intervals.length,
      minSeconds: Math.min(...intervals),
      maxSeconds: Math.max(...intervals),
      meanSeconds: intervals.reduce((a, b) => a + b, 0) / intervals.length,
      medianSeconds: intervals[Math.floor(intervals.length / 2)],
      regularityScore: 1,
    },
    ...overrides,
  };
}

test('cadence compatibility rewards half and whole beat patterns at 120 BPM', () => {
  const half = cadenceCompatibility(profile([0.5, 0.5, 0.5]), 0.5);
  const whole = cadenceCompatibility(profile([1, 1, 1]), 0.5);
  assert.ok(half > 0.85);
  assert.ok(whole > 0.85);
});

test('cadence compatibility penalises irregular intervals rather than trusting the median', () => {
  const regular = cadenceCompatibility(profile([0.5, 0.5, 0.5, 0.5]), 0.5);
  const irregular = cadenceCompatibility(profile([0.5, 0.9, 0.5, 1.1]), 0.5);
  assert.ok(irregular < regular);
});

test('cadence uses one subdivision for a sequence and retains zero-gap salvos', () => {
  const common = cadenceCompatibility(profile([0.5, 0.5, 0.5]), 0.5);
  const mixed = cadenceCompatibility(profile([0.5, 1, 0.5, 1]), 0.5);
  const salvo = cadenceCompatibility(profile([0, 0, 0]), 0.5);
  assert.ok(common > mixed);
  assert.equal(salvo, 0);
  assert.equal(
    cadenceCompatibility(
      profile([0.5, 0.5], {
        intervals: { ...profile([0.5, 0.5]).intervals, regularityScore: null },
      }),
      0.5,
    ),
    null,
  );
});

test('unknown or incomplete profiles and missing beat intervals are neutral/unknown', () => {
  assert.equal(cadenceCompatibility(undefined, 0.5), null);
  assert.equal(cadenceCompatibility(profile([0.5, 0.5], { completeness: 'partial' }), 0.5), null);
  assert.equal(cadenceCompatibility(profile([0.5], { intervals: null }), 0.5), null);
  assert.equal(
    musicTimingPreference(undefined, {
      beatIntervalSeconds: 0.5,
      vibe: 'chorus',
      isDownbeat: true,
      nearClimax: true,
      finale: true,
    }),
    0,
  );
});

test('local beat interval uses nearby real gaps and tempo fallback', () => {
  const analysis = { beat_times: [0, 0.5, 1.02, 1.49, 2.01, 3.01, 4.01], tempo_bpm: 90 };
  assert.ok(Math.abs(localBeatIntervalSeconds(analysis, 1.1) - 0.5) < 0.03);
  assert.ok(Math.abs(localBeatIntervalSeconds(analysis, 3.4) - 1) < 0.03);
  assert.equal(localBeatIntervalSeconds({ beat_times: [], tempo_bpm: 120 }, 2), 0.5);
  assert.equal(
    localBeatIntervalSeconds({ beat_times: [0, Number.NaN], tempo_bpm: 1e-320 }, 2),
    null,
  );
  assert.equal(localBeatIntervalSeconds(null, 2), null);
});

test('timing preference favours cadence matches in phrase peaks and sustained effects in quieter placement', () => {
  const matched = profile([0.5, 0.5, 0.5]);
  const sustained = profile([], {
    shots: [{ impactOffsetSeconds: 0 }],
    shotCount: 1,
    resolvedShotCount: 1,
    totalDurationSeconds: 4,
    intervals: null,
  });
  const phrase = musicTimingPreference(matched, {
    beatIntervalSeconds: 0.5,
    vibe: 'chorus',
    isDownbeat: true,
    nearClimax: true,
    finale: false,
  });
  const quiet = musicTimingPreference(sustained, {
    beatIntervalSeconds: null,
    vibe: 'verse',
    isDownbeat: false,
    nearClimax: false,
    finale: false,
  });
  assert.ok(phrase > 0);
  assert.ok(quiet > 0);
  assert.ok(Number.isFinite(phrase) && Number.isFinite(quiet));
});

test('short direct products receive precision preference at meaningful slots', () => {
  const direct = profile([], {
    shotCount: 1,
    resolvedShotCount: 1,
    totalDurationSeconds: 1.2,
    intervals: null,
  });
  const irregular = profile([0.3, 0.9, 0.4], {
    intervals: { ...profile([0.3, 0.9, 0.4]).intervals, regularityScore: 0.2 },
  });
  const context = {
    beatIntervalSeconds: 0.5,
    vibe: 'chorus',
    isDownbeat: true,
    nearClimax: true,
    finale: false,
  };
  assert.ok(musicTimingPreference(direct, context) > musicTimingPreference(irregular, context));
});
