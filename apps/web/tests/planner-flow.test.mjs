/** Behavioural tests for shopper validation, draft restoration and published timing adapters. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates } from '@showcrafter/fireworks';
import { solvePlan } from '@showcrafter/planner';
import { readFileSync } from 'node:fs';
import { plannerInput } from '../lib/shopper/planner/adapter.ts';
import { startRequestSchema, plannerContextSchema } from '../lib/shopper/planner/contracts.ts';
import {
  defaultAnswers,
  progressSchema,
  progressKey,
  currentCandidate,
} from '../lib/shopper/planner/progress.ts';

const id = '60000000-0000-4000-8000-000000000001';
const storeId = '40000000-0000-4000-8000-000000000001';
const at = '2026-10-04T00:00:00.000Z';
const answers = defaultAnswers('GBP');
test('draft reload validates all five answers, age and the idempotent request identity', () => {
  const draft = { request: id, age: at, question: 4, started: true, answers, session: null };
  assert.deepEqual(progressSchema.parse(JSON.parse(JSON.stringify(draft))), draft);
  assert.equal(progressSchema.safeParse({ ...draft, question: 5 }).success, false);
  assert.equal(
    progressSchema.safeParse({ ...draft, answers: { ...answers, budget_minor: -1 } }).success,
    false,
  );
  assert.notEqual(progressKey('leeds', id), progressKey('leeds'));
});
test('shopper action validation bounds money, minutes and excludes music uploads', () => {
  const request = { slug: 'leeds', request: id, age: at, answers, qr: null };
  assert.equal(startRequestSchema.safeParse(request).success, true);
  for (const invalid of [
    { budget_minor: 40001 },
    { length_min: 11 },
    { soundtrack: id },
    { looks: ['unknown'] },
  ]) {
    assert.equal(
      startRequestSchema.safeParse({ ...request, answers: { ...answers, ...invalid } }).success,
      false,
    );
  }
});
test('latest candidate is selected without mutating stored ranks', () => {
  const candidates = [
    { rank: 1, total: 100 },
    { rank: 3, total: 90 },
    { rank: 2, total: 110 },
  ];
  assert.equal(currentCandidate(candidates).rank, 3);
  assert.deepEqual(
    candidates.map((candidate) => candidate.rank),
    [1, 3, 2],
  );
  assert.throws(() => currentCandidate([]));
});
test('published composition impacts reach the solver in milliseconds with real safety facts', () => {
  const design = effectTemplates.find((template) => template.key === 'peony').design;
  const fixture = JSON.parse(
    readFileSync(
      new URL('../../../packages/planner/tests/fixtures/demo-store.json', import.meta.url),
    ),
  );
  const base = fixture.products[0];
  const product = {
    ...base,
    product_id: id,
    store_id: storeId,
    current_version_id: id,
    kind: 'cake',
    impact_delay_ms: 0,
  };
  const context = plannerContextSchema.parse({
    market: fixture.market,
    sale: fixture.sale,
    bands: [fixture.safety_band],
    products: [
      Object.fromEntries(Object.entries(product).filter(([key]) => key !== 'impact_delay_ms')),
    ],
  });
  const store = {
    store: { id: storeId },
    products: [
      {
        product_id: id,
        playback: {
          id,
          name: 'Published cake',
          kind: 'cake',
          composition: { tubes: [{ i: 0, letter: 'a', t_ms: 1250, angle_deg: 0 }] },
          effects: [{ letter: 'a', design }],
          pack_items: [],
        },
      },
    ],
  };
  const input = plannerInput(
    store,
    context,
    { ...fixture.answers, currency: fixture.market.currency },
    at,
  );
  assert.equal(input.products[0].impact_delay_ms, Math.round(1250 + design.breaks[0].at_s * 1000));
  assert.equal(input.products[0].min_safety_distance_m, base.min_safety_distance_m);
  assert.equal(solvePlan(input).status, 'ok');
  assert.throws(
    () => plannerInput({ ...store, products: [] }, context, fixture.answers, at),
    /range changed/,
  );
});
