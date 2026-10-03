/** Soundtrack solves preserve previous edits and optional analysis without mutating snapshots. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { solvePlan, musicAnalysisSchema } from '@showcrafter/planner';
import { prepareMusic } from '../lib/shopper/music/preparation.ts';
import { prepareEdit } from '../lib/shopper/planner/edit-preparation.ts';
import { matchEdit } from '../lib/shopper/planner/edit-rules.ts';
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/planner/tests/fixtures/demo-store.json', import.meta.url),
  ),
);
const analysis = musicAnalysisSchema.parse(
  JSON.parse(
    readFileSync(
      new URL('../../../services/music-analyser/tests/fixtures/analysis.json', import.meta.url),
    ),
  ),
);
const id = 'd0000000-0000-4000-8000-000000000001';
const track = 'd3000000-0000-4000-8000-000000000001';
const input = { ...fixture, music: null };
const names = new Map(
  input.products.map((product, index) => [product.product_id, `Product ${index}`]),
);
function plan(snapshot = input, edits = []) {
  const result = solvePlan(snapshot);
  assert.equal(result.status, 'ok');
  return {
    id,
    solver_snapshot: snapshot,
    input_hash: result.input_hash,
    plan_candidates: [{ ...result.candidates[0], id, revision: 0 }],
    plan_edits: edits,
  };
}
test('pending analysis uses ordinary pacing, and available shared features change timing deterministically', () => {
  const saved = plan();
  const original = structuredClone(saved);
  const pending = prepareMusic(saved, input, { track, music: null }, names);
  const timed = prepareMusic(saved, input, { track, music: analysis }, names);
  assert.equal(pending.status, 'ok');
  assert.equal(pending.snapshot.music, null);
  assert.equal(pending.snapshot.answers.soundtrack, track);
  assert.equal(timed.status, 'ok');
  assert.deepEqual(timed.snapshot.music, analysis);
  assert.notDeepEqual(timed.candidate.cues, pending.candidate.cues);
  assert.deepEqual(timed, prepareMusic(saved, input, { track, music: analysis }, names));
  assert.deepEqual(saved, original);
  assert.ok(timed.candidate.total_minor <= input.answers.budget_minor);
});
test('music preserves lowered budgets, quiet requests, swaps and the selected finale mood', () => {
  const snapshot = {
    ...input,
    answers: { ...input.answers, noise: 'quiet', budget_minor: 5000 },
    preferred_mood: 'big_finale',
  };
  const excluded = input.products[0].product_id;
  const saved = plan(snapshot, [
    { outcome: 'applied', ops: [{ op: 'swap_product', product_id: excluded }] },
  ]);
  const result = prepareMusic(saved, snapshot, { track, music: null }, names);
  assert.equal(result.status, 'ok');
  assert.equal(result.snapshot.answers.noise, 'quiet');
  assert.equal(result.snapshot.preferred_mood, 'big_finale');
  assert.equal(
    result.snapshot.products.some((product) => product.product_id === excluded),
    false,
  );
  assert.ok(result.candidate.total_minor <= 5000);
});
test('chip and typed operations on a musical plan retain its exact feature snapshot', () => {
  const snapshot = { ...input, answers: { ...input.answers, soundtrack: track }, music: analysis };
  const saved = plan(snapshot);
  for (const [source, message] of [
    ['chip', 'Cheaper'],
    ['rule', 'make it cheaper'],
  ]) {
    assert.equal(
      matchEdit({ source, message }, snapshot, saved.plan_candidates[0].total_minor)[0].op,
      'set_budget',
    );
    const result = prepareEdit({ id, source, message }, saved, { ...snapshot, music: null }, names);
    assert.deepEqual(result.snapshot.music, analysis);
    assert.equal(result.snapshot.answers.soundtrack, track);
  }
});
test('removing music clears feature timing and infeasible stock never produces a replacement candidate', () => {
  const snapshot = { ...input, answers: { ...input.answers, soundtrack: track }, music: analysis };
  const saved = plan(snapshot);
  const silent = prepareMusic(saved, snapshot, { track: null, music: null }, names);
  assert.equal(silent.status, 'ok');
  assert.equal(silent.snapshot.answers.soundtrack, null);
  assert.equal(silent.snapshot.music, null);
  const unavailable = prepareMusic(
    saved,
    { ...snapshot, products: [] },
    { track, music: analysis },
    names,
  );
  assert.equal(unavailable.status, 'infeasible');
  assert.equal('candidate' in unavailable, false);
});
