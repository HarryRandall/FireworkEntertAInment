import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { evaluateCuePlan } from '../lib/cue-generation/cue-quality.ts';
import { ProductAvailability } from '../lib/cue-generation/product-availability.ts';

function cue(overrides = {}) {
  return {
    timeSeconds: 1,
    impactTimeSeconds: 2,
    liftTimeSeconds: 1,
    tube: 0,
    productId: 'a',
    description: 'cue',
    slotIndex: 0,
    intensity: 0.5,
    emphasis: 'normal',
    ...overrides,
  };
}

function slot(overrides = {}) {
  return {
    index: 0,
    time: 2,
    tube: 0,
    intensity: 0.5,
    sectionLabel: 'verse',
    vibe: 'verse',
    nearClimax: false,
    isDownbeat: true,
    barPosition: 0,
    emphasis: 'normal',
    finale: false,
    ...overrides,
  };
}

test('quality metrics separate hard violations from advisory choreography signals', () => {
  const report = evaluateCuePlan({
    cues: [
      cue(),
      cue({ slotIndex: 1, tube: 1, impactTimeSeconds: 2 }),
      cue({ slotIndex: 2, productId: 'missing', impactTimeSeconds: 15 }),
    ],
    slots: [
      slot(),
      slot({ index: 1, tube: 1, emphasis: 'peak', nearClimax: true }),
      slot({ index: 2, sectionLabel: 'finale', finale: true }),
    ],
    products: [{ id: 'a' }],
    songDuration: 10,
    exactProductQuantities: new Map([['a', 1]]),
  });

  assert.deepEqual(report.hardViolations.unknownProductIds, ['missing']);
  assert.equal(report.hardViolations.outOfBoundsCueCount, 1);
  assert.deepEqual(report.hardViolations.inventoryExcess, [
    { productId: 'a', used: 2, available: 1 },
  ]);
  assert.equal(report.signals.simultaneousMomentCount, 1);
  assert.equal(report.signals.peakCoverageRatio, 1);
});

test('fixed-assortment ledger enforces exact quantities without changing unlimited planning', () => {
  const unlimited = new ProductAvailability();
  for (let index = 0; index < 100; index += 1) unlimited.recordUse('shell');
  assert.equal(unlimited.usedCount('shell'), 100);

  const fixed = new ProductAvailability(new Map([['shell', 2]]));
  fixed.recordUse('shell');
  fixed.recordUse('shell');
  assert.equal(fixed.canUse('shell'), false);
  assert.equal(fixed.canUse('unlisted-product'), false);
  assert.throws(() => fixed.recordUse('shell'), /No remaining quantity/);
});

test('planners retain a future-compatible quantity hook that production leaves unset', () => {
  for (const file of ['fast-planner.ts', 'beat-sync-planner.ts']) {
    const source = readFileSync(join(process.cwd(), 'lib/cue-generation', file), 'utf8');
    assert.match(source, /exactProductQuantities\?: ExactProductQuantities/);
    assert.match(source, /availability\.canUse/);
    assert.match(source, /availability\.recordUse/);
  }

  const runner = readFileSync(join(process.cwd(), 'lib/cue-generation/runner.server.ts'), 'utf8');
  assert.doesNotMatch(runner, /exactProductQuantities:/);
  assert.match(runner, /Supplier inventory is not a show assortment/);
});
