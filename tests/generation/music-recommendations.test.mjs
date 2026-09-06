import assert from 'node:assert/strict';
import { test } from 'node:test';

import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith('.') &&
      context.parentURL?.endsWith('.ts') &&
      !specifier.endsWith('.ts')
    )
      return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const { rankAssortmentMusic } = await import('../../lib/music-recommendations.ts');

function track(trackId, durationSeconds) {
  return {
    provider: 'jamendo',
    trackId,
    title: `Track ${trackId}`,
    artist: 'Artist',
    durationSeconds,
    previewUrl: `https://api.jamendo.com/${trackId}.mp3`,
    imageUrl: null,
    peaks: null,
    sourceUrl: `https://www.jamendo.com/track/${trackId}`,
    licenceName: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  };
}

function profile(intervals, totalDurationSeconds = 10) {
  const shots = [{ impactOffsetSeconds: 0 }];
  for (const interval of intervals) {
    shots.push({ impactOffsetSeconds: shots.at(-1).impactOffsetSeconds + interval });
  }
  return {
    productId: 'item',
    shotCount: shots.length,
    resolvedShotCount: shots.length,
    source: 'renderer_estimate',
    completeness: 'complete',
    shots,
    firstImpactOffsetSeconds: 0,
    lastImpactOffsetSeconds: shots.at(-1).impactOffsetSeconds,
    totalDurationSeconds,
    intervals: intervals.length
      ? {
          count: intervals.length,
          minSeconds: Math.min(...intervals),
          maxSeconds: Math.max(...intervals),
          meanSeconds: intervals.reduce((sum, value) => sum + value, 0) / intervals.length,
          medianSeconds: intervals[Math.floor(intervals.length / 2)],
          regularityScore: 1,
        }
      : null,
  };
}

function analysis({ energy, finale = true, beat = 0.5 } = {}) {
  return {
    schema_version: '1.4.0',
    file: 'track.mp3',
    duration_seconds: 60,
    tempo_bpm: 120,
    total_beats: 120,
    energy_timeline: energy.map((value, index) => ({ time: index * beat, energy: value })),
    sections: [],
    key_moments: [{ time: 10, energy: 1, prominence: 0.9, type: 'climax' }],
    buildups: [],
    beat_times: Array.from({ length: 16 }, (_, index) => index * beat),
    derived: finale ? { finale_window: { start: 6, end: 8 } } : undefined,
    music_profile: { raw_metrics: { section_contrast: 0.8 } },
  };
}

const timingProfiles = new Map([['item', { normal: profile([0.5, 0.5, 0.5], 10) }]]);

test('short assortments penalise tracks that exceed weighted capacity', () => {
  const results = rankAssortmentMusic({
    items: [{ catalogueItemId: 'item', quantity: 1 }],
    timingProfiles,
    tracks: [track('long', 90), track('short', 10)],
    analyses: new Map(),
  });
  assert.equal(results[0].track.trackId, 'short');
  assert.ok(results[0].score > results[1].score);
});

test('cadence stability and a strong analysed finale improve ranking', () => {
  const results = rankAssortmentMusic({
    items: [{ catalogueItemId: 'item', quantity: 1 }],
    timingProfiles,
    tracks: [track('weak', 10), track('strong', 10)],
    analyses: new Map([
      ['weak', analysis({ energy: [0.2, 0.2, 0.2, 0.2], finale: false })],
      ['strong', analysis({ energy: [0.1, 0.2, 0.3, 1] })],
    ]),
  });
  assert.equal(results[0].track.trackId, 'strong');
  assert.match(results[0].reasons.join(' '), /ending/i);
  assert.equal(results[0].evidence, 'analysed');
});

test('unknown analysis is explicit, bounded, deterministic, and provider-scoped', () => {
  const input = {
    items: [{ catalogueItemId: 'item', quantity: 1 }],
    timingProfiles,
    tracks: [
      track('2', 10),
      track('1', 10),
      track('1', 10),
      { ...track('bad', 10), provider: 'other' },
    ],
    analyses: new Map(),
  };
  const first = rankAssortmentMusic(input);
  const second = rankAssortmentMusic(input);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((result) => result.track.trackId),
    ['1', '2'],
  );
  assert.equal(first[0].evidence, 'duration-only');
  assert.ok(first.every((result) => result.score >= 0 && result.score <= 100));
  assert.ok(
    first[0].reasons.includes(
      'Initial suggestion based on track length; rhythm has not been analysed.',
    ),
  );
});

test('rhythmic packs prefer stable beats when other evidence is equal', () => {
  const stable = analysis({ energy: [0.2, 0.5, 0.3, 1] });
  const unstable = structuredClone(stable);
  stable.music_profile.raw_metrics.beat_stability = 1;
  unstable.music_profile.raw_metrics.beat_stability = 0;
  const result = rankAssortmentMusic({
    items: [{ catalogueItemId: 'item', quantity: 6 }],
    timingProfiles,
    tracks: [track('unstable', 60), track('stable', 60)],
    analyses: new Map([
      ['stable', stable],
      ['unstable', unstable],
    ]),
  });
  assert.equal(result[0].track.trackId, 'stable');
});

test('sparse packs prefer gentler tempo and unknown timing does not claim a duration fit', () => {
  const slow = analysis({ energy: [0.2, 0.4, 0.3, 0.4] });
  slow.tempo_bpm = 70;
  const fast = structuredClone(slow);
  fast.tempo_bpm = 180;
  const result = rankAssortmentMusic({
    items: [{ catalogueItemId: 'item', quantity: 6 }],
    timingProfiles: new Map([['item', { normal: profile([], 10) }]]),
    tracks: [track('fast', 60), track('slow', 60)],
    analyses: new Map([
      ['slow', slow],
      ['fast', fast],
    ]),
  });
  assert.equal(result[0].track.trackId, 'slow');
  const unknown = rankAssortmentMusic({
    items: [{ catalogueItemId: 'missing', quantity: 1 }],
    timingProfiles,
    tracks: [track('unknown', 60)],
    analyses: new Map(),
  });
  assert.doesNotMatch(unknown[0].reasons.join(' '), /suitable length/i);
});

test('recommendations are capped and unsuitable duration never receives a fit explanation', () => {
  const result = rankAssortmentMusic({
    items: [{ catalogueItemId: 'item', quantity: 1 }],
    timingProfiles,
    tracks: Array.from({ length: 10 }, (_, i) => track(String(i), 600)),
    analyses: new Map(),
  });
  assert.equal(result.length, 5);
  assert.ok(result.every(({ reasons }) => !reasons.join(' ').includes('suitable length')));
});
