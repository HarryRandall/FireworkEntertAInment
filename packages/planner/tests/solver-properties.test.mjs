// Seeded generative properties check output invariants independently of the solver's filter implementation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { solvePlan } from '../src/index.ts';
import { input, product, uuid } from './solver-fixtures.mjs';

function random(seed) {
  let state = seed;
  return (limit) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
}

test('generated store ranges never exceed budget, physical stock, safety or market eligibility', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const pick = random(seed);
    const snapshot = input(
      Array.from({ length: 1 + pick(25) }, (_, index) =>
        product(index + 1, {
          price_minor: pick(10000),
          stock_qty: pick(5),
          hidden: pick(8) === 0,
          min_safety_distance_m: [null, 8, 15, 25][pick(4)],
          noise_level: [null, 0, 1, 2, 3][pick(5)],
          safety_confirmed: pick(5) !== 0,
          has_bangs: pick(3) === 0,
          has_crackle: pick(3) === 0,
          has_whistle: pick(3) === 0,
          duration_ms: 1 + pick(60000),
          energy: pick(101) / 100,
          impact_delay_ms: 0,
          store_id: pick(8) === 0 ? uuid(899) : uuid(900),
          product_market: {
            market: pick(5) === 0 ? 'DE' : 'GB',
            allowed: pick(5) !== 0,
            confirmed: pick(5) !== 0,
            legal_category: pick(3) === 0 ? 'F3' : 'F2',
            min_age: pick(3) === 0 ? 21 : 18,
          },
        }),
      ),
    );
    snapshot.answers.budget_minor = pick(30000);
    snapshot.answers.noise = ['quiet', 'normal', 'loud'][pick(3)];
    snapshot.answers.length_min = 1 + pick(10);
    const result = solvePlan(snapshot, { candidate_count: 5 });
    assert.notEqual(result.status, 'invalid_input', `seed ${seed}`);
    if (result.status !== 'ok') continue;
    assert.deepEqual(result, solvePlan(snapshot, { candidate_count: 5 }), `seed ${seed}`);
    for (const candidate of result.candidates) {
      assert.ok(candidate.total_minor <= snapshot.answers.budget_minor, `budget seed ${seed}`);
      let total = 0;
      let end = 0;
      let last = -500;
      const counts = new Map();
      for (const cue of candidate.cues) {
        const unit = snapshot.products.find((item) => item.product_id === cue.product_id);
        assert.ok(unit);
        counts.set(unit.product_id, (counts.get(unit.product_id) ?? 0) + 1);
        assert.ok(counts.get(unit.product_id) <= unit.stock_qty, `stock seed ${seed}`);
        assert.ok(
          unit.safety_confirmed &&
            unit.min_safety_distance_m !== null &&
            unit.min_safety_distance_m <= 15,
        );
        assert.ok(
          unit.noise_level !== null &&
            unit.noise_level <= { quiet: 1, normal: 2, loud: 3 }[snapshot.answers.noise],
        );
        if (snapshot.answers.noise === 'quiet')
          assert.ok(!unit.has_bangs && !unit.has_crackle && !unit.has_whistle);
        assert.equal(unit.product_market.market, 'GB');
        assert.equal(unit.product_market.allowed, true);
        assert.equal(unit.product_market.confirmed, true);
        assert.equal(unit.product_market.legal_category, 'F2');
        assert.ok(unit.product_market.min_age <= 18);
        assert.equal(unit.store_id, snapshot.store_id);
        assert.equal(unit.hidden, false);
        assert.equal(unit.status, 'published');
        assert.equal(unit.currency, candidate.currency);
        assert.ok(Number.isSafeInteger(cue.t_ms) && cue.t_ms >= last + 500);
        last = cue.t_ms;
        total += unit.price_minor;
        end = Math.max(end, cue.t_ms + unit.duration_ms);
      }
      assert.equal(total, candidate.total_minor);
      assert.equal(end, candidate.duration_ms);
      for (const score of [...Object.values(candidate.scores), candidate.score])
        assert.ok(score >= 0 && score <= 1);
    }
  }
});
