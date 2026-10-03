// Fixed demo projections protect ranked products, prices, ignition clocks, scores and cache identities.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { solvePlan } from '../src/index.ts';

const snapshot = JSON.parse(
  readFileSync(new URL('./fixtures/demo-store.json', import.meta.url), 'utf8'),
);
const goldens = JSON.parse(
  readFileSync(new URL('./fixtures/demo-plans.json', import.meta.url), 'utf8'),
);
for (const golden of goldens) {
  test(`Hartley demo ${golden.name} preserves its ranked plan documents`, () => {
    const request = { ...structuredClone(snapshot), answers: golden.answers };
    assert.deepEqual(solvePlan(request, { candidate_count: 3 }), golden.expected);
  });
}
