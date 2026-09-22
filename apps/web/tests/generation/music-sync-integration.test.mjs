import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return nextResolve('data:text/javascript,export {};', context);
    const unresolved = specifier.startsWith('@/')
      ? join(root, specifier.slice(2))
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

const [
  { buildProductTimingProfile },
  { DEFAULT_DESIGN },
  { cadenceCompatibility, localBeatIntervalSeconds, musicTimingPreference },
  { rankAssortmentMusic },
] = await Promise.all([
  import('../../lib/fireworks/timing-profile.ts'),
  import('../../lib/fireworks/design.ts'),
  import('../../lib/cue-generation/music-product-matching.ts'),
  import('../../lib/music-recommendations.ts'),
]);

function product(id, overrides = {}) {
  return {
    id,
    slug: id,
    name: id,
    description: null,
    sortOrder: 0,
    durationSeconds: null,
    heightMeters: null,
    caliber: null,
    shotCount: 1,
    spec: { geometry: 'sphere', size: 20, shellLife: 1 },
    rawSpec: null,
    renderDesign: DEFAULT_DESIGN,
    baseEffect: null,
    variant: null,
    ...overrides,
  };
}

function track(trackId, durationSeconds) {
  return {
    provider: 'jamendo',
    trackId,
    title: trackId,
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

test('timing profile keeps missing multishot children unknown and preserves resolved offsets', () => {
  const unknown = buildProductTimingProfile({
    product: product('multi', { shotCount: 3 }),
    emphasis: 'normal',
  });
  assert.equal(unknown.completeness, 'unknown');
  assert.equal(unknown.totalDurationSeconds, null);

  const resolved = buildProductTimingProfile({
    product: product('multi', { shotCount: 3 }),
    emphasis: 'normal',
    children: [
      { firework: product('a'), timeOffsetSeconds: 0 },
      { firework: product('b'), timeOffsetSeconds: 0.5 },
      { firework: product('c'), timeOffsetSeconds: 1 },
    ],
  });
  assert.equal(resolved.completeness, 'complete');
  assert.deepEqual(
    resolved.shots.map((shot) => shot.launchOffsetSeconds),
    [0, 0.5, 1],
  );
  assert.ok(resolved.intervals?.regularityScore != null);
});

test('cadence uses real local beat gaps and remains neutral without evidence', async () => {
  const analysis = { beat_times: [0, 0.5, 1, 1.5], tempo_bpm: 90 };
  assert.equal(localBeatIntervalSeconds(analysis, 1.1), 0.5);
  assert.equal(localBeatIntervalSeconds(null, 1), null);
  const profile = {
    productId: 'multi',
    shotCount: 4,
    resolvedShotCount: 4,
    source: 'renderer_estimate',
    completeness: 'complete',
    shots: [0, 0.5, 1, 1.5].map((impactOffsetSeconds) => ({
      productId: 'multi',
      launchOffsetSeconds: impactOffsetSeconds,
      impactOffsetSeconds,
      endOffsetSeconds: impactOffsetSeconds + 1,
    })),
    firstImpactOffsetSeconds: 0,
    lastImpactOffsetSeconds: 1.5,
    totalDurationSeconds: 2.5,
    intervals: {
      count: 3,
      minSeconds: 0.5,
      maxSeconds: 0.5,
      meanSeconds: 0.5,
      medianSeconds: 0.5,
      regularityScore: 1,
    },
  };
  assert.ok(cadenceCompatibility(profile, 0.5) > 0.85);
  assert.equal(cadenceCompatibility(undefined, 0.5), null);
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

test('recommendations rank real Jamendo tracks by bounded assortment capacity', () => {
  const timingProfiles = new Map([
    [
      'item',
      {
        normal: {
          productId: 'item',
          shotCount: 1,
          resolvedShotCount: 1,
          source: 'renderer_estimate',
          completeness: 'complete',
          shots: [],
          firstImpactOffsetSeconds: 0,
          lastImpactOffsetSeconds: 1,
          totalDurationSeconds: 10,
          intervals: null,
        },
      },
    ],
  ]);
  const results = rankAssortmentMusic({
    items: [{ catalogueItemId: 'item', quantity: 1 }],
    timingProfiles,
    tracks: [track('long', 90), track('short', 10), { ...track('fake', 10), provider: 'other' }],
    analyses: new Map(),
  });
  assert.equal(results[0].track.trackId, 'short');
  assert.ok(results.every((result) => result.track.provider === 'jamendo'));
  assert.ok(results.every((result) => result.evidence === 'duration-only'));
});

test('recommendations use the declared finale window and stable local beat evidence', () => {
  const timingProfiles = new Map([
    [
      'multi',
      {
        normal: {
          productId: 'multi',
          shotCount: 4,
          resolvedShotCount: 4,
          source: 'renderer_estimate',
          completeness: 'complete',
          shots: [0, 0.5, 1, 1.5].map((impactOffsetSeconds) => ({
            productId: 'multi',
            launchOffsetSeconds: impactOffsetSeconds,
            impactOffsetSeconds,
            endOffsetSeconds: impactOffsetSeconds + 1,
          })),
          firstImpactOffsetSeconds: 0,
          lastImpactOffsetSeconds: 1.5,
          totalDurationSeconds: 2.5,
          intervals: {
            count: 3,
            minSeconds: 0.5,
            maxSeconds: 0.5,
            meanSeconds: 0.5,
            medianSeconds: 0.5,
            regularityScore: 1,
          },
        },
      },
    ],
  ]);
  const results = rankAssortmentMusic({
    items: [{ catalogueItemId: 'multi', quantity: 1 }],
    timingProfiles,
    tracks: [track('analysed', 2.5)],
    analyses: new Map([
      [
        'analysed',
        {
          energy_timeline: [
            { time: 0, energy: 0.1 },
            { time: 1, energy: 0.2 },
            { time: 8, energy: 1 },
          ],
          key_moments: [],
          buildups: [],
          tempo_bpm: 120,
          beat_times: [0, 0.5, 1, 1.5],
          derived: { finale_window: { start: 7, end: 9 } },
          music_profile: { raw_metrics: { beat_stability: 1, section_contrast: 0.8 } },
        },
      ],
    ]),
  });
  assert.equal(results[0].evidence, 'analysed');
  assert.ok(results[0].reasons.some((reason) => reason.includes('strong ending')));
  assert.ok(results[0].reasons.some((reason) => reason.includes('steady rhythm')));
});
