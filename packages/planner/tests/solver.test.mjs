// Behavioural checks cover purchase constraints, cache identities and ranked alternatives.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { solvePlan } from '../src/index.ts';
import { input, product, uuid } from './solver-fixtures.mjs';

function successful(snapshot, options = {}) {
  const result = solvePlan(snapshot, options);
  assert.equal(result.status, 'ok', JSON.stringify(result));
  assert.ok(result.candidates.length > 0);
  return result;
}

test('same inputs repeat exactly, stay immutable and produce a stable ranked prefix', () => {
  const snapshot = input([
    product(1),
    product(2, { energy: 0.9 }),
    product(3, { colours: ['silver'] }),
  ]);
  const original = structuredClone(snapshot);
  const one = successful(snapshot);
  const many = successful(snapshot, { candidate_count: 10 });
  assert.deepEqual(one.candidates[0], many.candidates[0]);
  assert.deepEqual(many, solvePlan(snapshot, { candidate_count: 10 }));
  assert.deepEqual(snapshot, original);
  assert.equal(one.input_hash, many.input_hash);
  assert.ok(many.candidates.length > 1);
  for (let i = 1; i < many.candidates.length; i++) {
    assert.ok(many.candidates[i - 1].score >= many.candidates[i].score);
    assert.equal(many.candidates[i].rank, i + 1);
  }
});

test('material alternatives change the headline or at least a quarter of unit quantities', () => {
  const { candidates } = successful(input(), { candidate_count: 10 });
  for (let i = 0; i < candidates.length; i++) {
    for (const other of candidates.slice(i + 1)) {
      const candidate = candidates[i];
      const counts = new Map();
      candidate.cues.forEach((cue) =>
        counts.set(cue.product_id, (counts.get(cue.product_id) ?? 0) + 1),
      );
      let shared = 0;
      other.cues.forEach((cue) => {
        if ((counts.get(cue.product_id) ?? 0) > 0) {
          shared++;
          counts.set(cue.product_id, counts.get(cue.product_id) - 1);
        }
      });
      assert.ok(
        candidate.headline_product_id !== other.headline_product_id ||
          shared / Math.max(candidate.cues.length, other.cues.length) <= 0.75,
      );
    }
  }
});

test('one unit in stock has no invented alternative', () => {
  const result = successful(input([product(1, { stock_qty: 1 })]), { candidate_count: 10 });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.exhausted, true);
});

test('request-level market, sale, garden and age checks fail closed', () => {
  const mutations = [
    (s) => {
      s.market.enabled = false;
    },
    (s) => {
      s.market.currency = 'EUR';
    },
    (s) => {
      s.sale.open = false;
    },
    (s) => {
      s.age_confirmation = null;
    },
    (s) => {
      s.age_confirmation.minimum_age = 17;
    },
    (s) => {
      s.safety_band.band = 'small';
    },
    (s) => {
      s.safety_band.market = 'DE';
    },
  ];
  for (const mutate of mutations) {
    const snapshot = input();
    mutate(snapshot);
    assert.equal(solvePlan(snapshot).status, 'infeasible');
  }
});

test('every product eligibility fact independently excludes an otherwise attractive product', () => {
  const overrides = [
    { stock_qty: 0 },
    { hidden: true },
    { status: 'draft' },
    { store_id: uuid(899) },
    { price_minor: 15001 },
    { currency: 'EUR' },
    { min_safety_distance_m: 16 },
    { min_safety_distance_m: null },
    { noise_level: null },
    { noise_level: 3 },
    { safety_confirmed: false },
    {
      product_market: {
        market: 'GB',
        allowed: false,
        legal_category: 'F2',
        min_age: 18,
        confirmed: true,
      },
    },
    {
      product_market: {
        market: 'US',
        allowed: true,
        legal_category: 'F2',
        min_age: 18,
        confirmed: true,
      },
    },
    {
      product_market: {
        market: 'GB',
        allowed: true,
        legal_category: 'F3',
        min_age: 18,
        confirmed: true,
      },
    },
    {
      product_market: {
        market: 'GB',
        allowed: true,
        legal_category: 'F2',
        min_age: 21,
        confirmed: true,
      },
    },
    {
      product_market: {
        market: 'GB',
        allowed: true,
        legal_category: 'F2',
        min_age: 18,
        confirmed: false,
      },
    },
  ];
  for (const override of overrides) {
    assert.equal(
      solvePlan(input([product(1, override)])).status,
      'infeasible',
      JSON.stringify(override),
    );
  }
});

test('quiet means no bangs, crackle or whistles even at a low noise ordinal', () => {
  for (const flag of ['has_bangs', 'has_crackle', 'has_whistle']) {
    const snapshot = input([product(1, { [flag]: true })]);
    snapshot.answers.noise = 'quiet';
    assert.equal(solvePlan(snapshot).status, 'infeasible');
  }
});

test('exact budget, zero price, repeated quantities and indivisible cakes use whole-unit prices', () => {
  const snapshot = input([product(1, { price_minor: 2000, stock_qty: 2 })]);
  snapshot.answers.budget_minor = 4000;
  const candidate = successful(snapshot).candidates[0];
  assert.equal(candidate.cues.length, 2);
  assert.equal(candidate.total_minor, 4000);
  snapshot.answers.budget_minor = 1999;
  assert.equal(solvePlan(snapshot).status, 'infeasible');
  snapshot.products[0].price_minor = 0;
  snapshot.answers.budget_minor = 0;
  assert.equal(successful(snapshot).candidates[0].total_minor, 0);
});

test('hash is order-independent and changes for every selection-affecting snapshot', () => {
  const snapshot = input();
  const original = successful(snapshot);
  const shuffled = structuredClone(snapshot);
  shuffled.products.reverse();
  shuffled.answers.looks.reverse();
  shuffled.sale.evaluated_at = '2026-11-06T12:00:00Z';
  assert.deepEqual(successful(shuffled), original);
  const mutations = [
    (s) => {
      s.products[0].stock_qty++;
    },
    (s) => {
      s.products[0].price_minor++;
    },
    (s) => {
      s.products[0].current_version_id = uuid(800);
    },
    (s) => {
      s.products[0].impact_delay_ms++;
    },
    (s) => {
      s.products[0].energy = 0.6;
    },
    (s) => {
      s.answers.occasion = 'Birthday';
    },
    (s) => {
      s.safety_band.max_distance_m++;
    },
    (s) => {
      s.age_confirmation.minimum_age++;
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(snapshot);
    mutate(changed);
    assert.notEqual(successful(changed).input_hash, original.input_hash);
  }
  const weighted = successful(snapshot, {
    weights: { variety: 1, pacing: 0, budget_use: 0, look_match: 0 },
  });
  assert.notEqual(weighted.input_hash, original.input_hash);
});

test('unknown or corrupt input and invalid tuning return typed validation failures', () => {
  for (const value of [
    null,
    {},
    { ...input(), surprise: true },
    input([product(1), product(1)]),
    input([product(1, { price_minor: Number.MAX_SAFE_INTEGER + 1 })]),
    input([product(1, { duration_ms: Infinity })]),
    input([product(1, { impact_delay_ms: 30001 })]),
  ]) {
    assert.equal(solvePlan(value).status, 'invalid_input');
  }
  for (const options of [
    { candidate_count: 0 },
    { candidate_count: 11 },
    { weights: { variety: 0, pacing: 0, budget_use: 0, look_match: 0 } },
  ]) {
    assert.equal(solvePlan(input(), options).status, 'invalid_input');
  }
});

test('millisecond clocks stay inside PostgreSQL integer storage bounds', () => {
  assert.equal(solvePlan(input([product(1, { duration_ms: 2147483648 })])).status, 'invalid_input');
  const snapshot = input([
    product(1, { duration_ms: 2147483647, stock_qty: 2, impact_delay_ms: 0 }),
  ]);
  snapshot.answers.length_min = 2147483647 / 60000;
  const candidate = successful(snapshot).candidates[0];
  assert.equal(candidate.cues.length, 1);
  assert.equal(candidate.duration_ms, 2147483647);
});

test('market filters and currency accounting work for each supported market', () => {
  for (const [code, currency] of [
    ['GB', 'GBP'],
    ['US', 'USD'],
    ['DE', 'EUR'],
    ['AU', 'AUD'],
  ]) {
    const snapshot = input();
    snapshot.market.code = code;
    snapshot.market.currency = currency;
    snapshot.answers.currency = currency;
    snapshot.safety_band.market = code;
    for (const unit of snapshot.products) {
      unit.currency = currency;
      unit.product_market.market = code;
    }
    assert.equal(successful(snapshot).candidates[0].currency, currency);
  }
});

test('immutable published packs need no composition version but ordinary products do', () => {
  const snapshot = input([product(1)]);
  const original = snapshot.products[0];
  snapshot.products = [{ ...original, kind: 'pack', current_version_id: null }];
  assert.equal(solvePlan(snapshot).status, 'ok');
  snapshot.products = [{ ...original, current_version_id: null }];
  assert.equal(solvePlan(snapshot).status, 'invalid_input');
});
