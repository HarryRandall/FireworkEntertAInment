import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const path = join(root, specifier.slice(2));
      for (const candidate of [path, `${path}.ts`, `${path}.tsx`]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const path = join(dirname(fileURLToPath(context.parentURL)), specifier);
      for (const candidate of [path, `${path}.ts`, `${path}.tsx`]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const [
  { buildProductTimingProfile },
  { DEFAULT_DESIGN, scaleDesignForCaliber, scaleDesignForEmphasis },
  { estimateFireworkDesignTiming },
  { productLiftTimeSeconds },
] = await Promise.all([
  import('../../lib/fireworks/timing-profile.ts'),
  import('../../lib/fireworks/design.ts'),
  import('../../lib/fireworks/timing.ts'),
  import('../../lib/cue-generation/impact-timing.ts'),
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

test('direct profile reports renderer lift and impact offsets', () => {
  const firework = product('direct');
  const profile = buildProductTimingProfile({ product: firework, emphasis: 'normal' });

  assert.equal(profile.source, 'renderer_estimate');
  assert.equal(profile.completeness, 'complete');
  assert.equal(profile.shotCount, 1);
  assert.equal(profile.resolvedShotCount, 1);
  assert.equal(profile.shots[0].launchOffsetSeconds, 0);
  assert.ok(profile.shots[0].impactOffsetSeconds > 0);
  assert.equal(profile.firstImpactOffsetSeconds, profile.shots[0].impactOffsetSeconds);
  assert.equal(profile.intervals, null);
});

test('multishot without resolved children stays explicitly unknown', () => {
  const profile = buildProductTimingProfile({
    product: product('multi', { shotCount: 3 }),
    emphasis: 'accent',
  });

  assert.equal(profile.completeness, 'unknown');
  assert.equal(profile.shotCount, 3);
  assert.equal(profile.resolvedShotCount, 0);
  assert.equal(profile.totalDurationSeconds, null);
  assert.deepEqual(profile.shots, []);
});

test('resolved child offsets and pan affect each estimated impact independently', () => {
  const first = product('first', { caliber: '20mm' });
  const second = product('second', { caliber: '50mm' });
  const profile = buildProductTimingProfile({
    product: product('multi', { shotCount: 2 }),
    emphasis: 'peak',
    children: [
      { firework: first, timeOffsetSeconds: 0.2, panDegrees: 0 },
      { firework: second, timeOffsetSeconds: 1.7, panDegrees: 35 },
    ],
  });

  assert.equal(profile.completeness, 'complete');
  assert.equal(profile.resolvedShotCount, 2);
  assert.equal(profile.shots[0].launchOffsetSeconds, 0.2);
  assert.equal(profile.shots[1].launchOffsetSeconds, 1.7);
  assert.equal(profile.intervals?.count, 1);
  assert.equal(profile.intervals?.regularityScore, null);
  assert.equal(profile.firstImpactOffsetSeconds, profile.shots[0].impactOffsetSeconds);
  assert.equal(profile.lastImpactOffsetSeconds, profile.shots[1].impactOffsetSeconds);
});

test('direct impact offset equals the canonical renderer lift estimate', () => {
  const firework = product('direct', { caliber: '30mm' });
  const profile = buildProductTimingProfile({ product: firework, emphasis: 'normal' });
  assert.equal(profile.shots[0].impactOffsetSeconds, productLiftTimeSeconds(firework, 'normal'));
});

test('partial child resolution does not publish whole-product timing facts', () => {
  const profile = buildProductTimingProfile({
    product: product('multi', { shotCount: 3 }),
    emphasis: 'normal',
    children: [{ firework: product('only'), timeOffsetSeconds: 0.5 }],
  });
  assert.equal(profile.completeness, 'partial');
  assert.equal(profile.firstImpactOffsetSeconds, null);
  assert.equal(profile.lastImpactOffsetSeconds, null);
  assert.equal(profile.totalDurationSeconds, null);
  assert.equal(profile.intervals, null);
});

test('simultaneous and irregular impacts remain finite and deterministic', () => {
  const children = [0, 0, 2.5, 2.5].map((timeOffsetSeconds, index) => ({
    firework: product(`child-${index}`),
    timeOffsetSeconds,
  }));
  const input = { product: product('multi', { shotCount: 4 }), emphasis: 'normal', children };
  const first = buildProductTimingProfile(input);
  const second = buildProductTimingProfile(input);
  assert.deepEqual(first, second);
  assert.equal(first.completeness, 'complete');
  assert.ok(first.intervals);
  assert.equal(first.intervals.medianSeconds, 0);
  assert.equal(first.intervals.regularityScore, 0);
  assert.ok(first.totalDurationSeconds > 0);
  assert.deepEqual(
    children.map((child) => child.timeOffsetSeconds),
    [0, 0, 2.5, 2.5],
  );
});

function sequence(offsets, overrides = {}) {
  return {
    product: product('pack', { shotCount: offsets.length, ...overrides }),
    emphasis: 'normal',
    children: offsets.map((timeOffsetSeconds, index) => ({
      firework: product(`shot-${index}`),
      timeOffsetSeconds,
    })),
  };
}

test('regular half-second cadence preserves intervals, while uneven cadence scores lower', () => {
  const regular = buildProductTimingProfile(sequence([0, 0.5, 1, 1.5]));
  const irregular = buildProductTimingProfile(sequence([0, 0.2, 1.8, 2]));
  assert.ok(Math.abs(regular.intervals.medianSeconds - 0.5) < 1e-10);
  assert.ok(regular.intervals.regularityScore > 0.999999);
  assert.ok(irregular.intervals.regularityScore < regular.intervals.regularityScore);
});

test('a simultaneous salvo has no periodic cadence', () => {
  const profile = buildProductTimingProfile(sequence([0, 0, 0]));
  assert.equal(profile.intervals.meanSeconds, 0);
  assert.equal(profile.intervals.regularityScore, null);
});

test('resolved single-child sequences retain their non-zero ignition offset', () => {
  const profile = buildProductTimingProfile(sequence([2]));
  assert.equal(profile.completeness, 'complete');
  assert.equal(profile.shots[0].launchOffsetSeconds, 2);
});

test('empty and count-mismatched child lists cannot claim complete timing', () => {
  assert.equal(
    buildProductTimingProfile(sequence([], { shotCount: null })).completeness,
    'unknown',
  );
  assert.equal(
    buildProductTimingProfile(sequence([0, 1], { shotCount: 1 })).completeness,
    'partial',
  );
  assert.equal(
    buildProductTimingProfile(sequence([0, NaN], { shotCount: 1 })).completeness,
    'partial',
  );
});

test('invalid counts, child offsets and non-finite design timing cannot leak numeric errors', () => {
  for (const shotCount of [NaN, Infinity, -1, 0, 0.5]) {
    const profile = buildProductTimingProfile(sequence([0, 1], { shotCount }));
    assert.equal(profile.completeness, 'unknown');
    assert.equal(profile.shotCount, null);
  }
  for (const offset of [NaN, Infinity, -1]) {
    const profile = buildProductTimingProfile(sequence([0, offset]));
    assert.equal(profile.completeness, 'partial');
    assert.equal(profile.totalDurationSeconds, null);
    for (const shot of profile.shots) {
      assert.ok(Number.isFinite(shot.impactOffsetSeconds));
    }
  }
  const design = structuredClone(DEFAULT_DESIGN);
  design.stars.outer.burst.life = [NaN, Infinity];
  const profile = buildProductTimingProfile({
    product: product('invalid', { renderDesign: design }),
    emphasis: 'normal',
  });
  assert.equal(profile.completeness, 'unknown');
  assert.deepEqual(profile.shots, []);
});

test('child impact ordering preserves identity without mutating input', () => {
  const input = sequence([4, 0, 2]);
  const before = structuredClone(input);
  const profile = buildProductTimingProfile(input);
  assert.deepEqual(
    profile.shots.map((shot) => shot.productId),
    ['shot-1', 'shot-2', 'shot-0'],
  );
  assert.deepEqual(input, before);
});

test('child calibre, angle and emphasis use the same design timing estimator', () => {
  for (const emphasis of ['normal', 'accent', 'peak']) {
    const input = sequence([0.2, 1.7]);
    input.emphasis = emphasis;
    input.children[1].firework.caliber = '50mm';
    input.children[1].panDegrees = 35;
    const expected = estimateFireworkDesignTiming(
      scaleDesignForEmphasis(scaleDesignForCaliber(DEFAULT_DESIGN, '50mm'), emphasis),
      35,
    );
    const profile = buildProductTimingProfile(input);
    const shot = profile.shots.find((entry) => entry.productId === 'shot-1');
    assert.equal(shot.impactOffsetSeconds, 1.7 + expected.liftTimeSeconds);
    assert.equal(shot.endOffsetSeconds, 1.7 + expected.endSeconds);
    const direct = product('direct', { caliber: '50mm' });
    assert.equal(
      buildProductTimingProfile({ product: direct, emphasis }).firstImpactOffsetSeconds,
      productLiftTimeSeconds(direct, emphasis),
    );
  }
});

test('ground effects start at ignition and long tails extend past the last impact', () => {
  const ground = product('ground', { renderDesign: { ...DEFAULT_DESIGN, geometry: 'fountain' } });
  const profile = buildProductTimingProfile({ product: ground, emphasis: 'normal' });
  assert.equal(profile.firstImpactOffsetSeconds, 0);
  assert.ok(profile.totalDurationSeconds > 0);
  const input = sequence([0, 60]);
  const long = buildProductTimingProfile(input);
  assert.ok(long.totalDurationSeconds > 60);
  assert.ok(long.totalDurationSeconds > long.lastImpactOffsetSeconds);
});
