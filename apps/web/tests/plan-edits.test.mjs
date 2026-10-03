/** Non-AI rule matching, operation generation, verified improvements and quantity diffs. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { solvePlan } from '@showcrafter/planner';
import { matchEdit } from '../lib/shopper/planner/edit-rules.ts';
import { editInput, solveEdit } from '../lib/shopper/planner/edit-solver.ts';
import { editRequestSchema, savedEditSchema } from '../lib/shopper/planner/edit-contracts.ts';
import { prepareEdit } from '../lib/shopper/planner/edit-preparation.ts';
import { planDiff } from '../lib/shopper/planner/edit-diff.ts';
import { showName } from '../lib/shopper/planner/names.ts';
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/planner/tests/fixtures/demo-store.json', import.meta.url),
  ),
);
const input = { ...fixture, music: null };
const before = solvePlan(input).candidates[0];
const names = new Map(
  input.products.map((product, index) => [product.product_id, `Firework ${index}`]),
);
const id = 'd0000000-0000-4000-8000-000000000001';
const request = {
  id,
  session: id,
  candidate: id,
  revision: 0,
  seq: 1,
  source: 'chip',
  message: 'Cheaper',
};
const plan = {
  id,
  solver_snapshot: input,
  input_hash: 'original',
  plan_candidates: [{ ...before, id, revision: 0, name: null }],
  plan_edits: [],
};
test('each chip generates a closed structured operation in documented units', () => {
  const expected = {
    Longer: [{ op: 'set_length', length_min: Math.min(10, input.answers.length_min + 1) }],
    Cheaper: [{ op: 'set_budget', max_minor: Math.floor(before.total_minor * 0.8) }],
    'More crackle': [{ op: 'more', attribute: 'crackle' }],
    'Bigger finale': [{ op: 'more', attribute: 'finale' }],
    Quieter: [{ op: 'set_noise', noise: 'quiet' }],
    'Swap this firework': [{ op: 'swap_product', product_id: input.products[0].product_id }],
  };
  for (const [message, ops] of Object.entries(expected))
    assert.deepEqual(
      matchEdit(
        { source: 'chip', message, product: input.products[0].product_id },
        input,
        before.total_minor,
      ),
      ops,
    );
  assert.deepEqual(matchEdit({ source: 'chip', message: 'Swap this firework' }, input, 0), []);
  assert.deepEqual(matchEdit({ source: 'chip', message: 'Invent something' }, input, 0), []);
});
test('normalises exact phrases and recognises decimal currency budgets without fuzzy guessing', () => {
  for (const message of ['Make it longer', '  MAKE   IT LONGER.  '])
    assert.equal(
      matchEdit({ source: 'rule', message }, input, before.total_minor)[0].op,
      'set_length',
    );
  assert.deepEqual(
    matchEdit({ source: 'rule', message: 'keep it under £45.50' }, input, before.total_minor),
    [{ op: 'set_budget', max_minor: 4550 }],
  );
  assert.deepEqual(
    matchEdit({ source: 'rule', message: 'budget 45 gbp' }, input, before.total_minor),
    [{ op: 'set_budget', max_minor: 4500 }],
  );
  for (const message of [
    'no crackle',
    'longer and quieter',
    'under $50',
    'not cheaper',
    'under -5',
    'under 1e4',
    'under 10.999',
    'surprise me',
    'toString',
    '__proto__',
  ])
    assert.deepEqual(matchEdit({ source: 'rule', message }, input, before.total_minor), []);
});
test('ops never raise a budget, relax safety or mutate input; quiet and swap stay constrained', () => {
  const original = structuredClone(input);
  const changed = editInput(input, [
    { op: 'set_budget', max_minor: 999999 },
    { op: 'set_noise', noise: 'quiet' },
    { op: 'swap_product', product_id: input.products[0].product_id },
  ]);
  assert.deepEqual(input, original);
  assert.equal(changed.answers.budget_minor, input.answers.budget_minor);
  assert.deepEqual(changed.safety_band, input.safety_band);
  assert.equal(
    changed.products.some((product) => product.product_id === input.products[0].product_id),
    false,
  );
});
test('cheaper re-solves deterministically and verifies its actual cost rather than promising an edit', () => {
  const ops = matchEdit(request, input, before.total_minor);
  const next = editInput(input, ops);
  const result = solveEdit(next, before, input, ops);
  assert.equal(result.status, 'ok');
  assert.ok(result.candidate.total_minor < before.total_minor);
  assert.ok(result.candidate.total_minor <= ops[0].max_minor);
  assert.deepEqual(solveEdit(next, before, input, ops), result);
  for (const cue of result.candidate.cues)
    assert.ok(next.products.find((product) => product.product_id === cue.product_id).stock_qty > 0);
});
test('an impossible budget and already quiet show return infeasible without claiming success', () => {
  const zero = [{ op: 'set_budget', max_minor: 0 }];
  const paid = {
    ...input,
    products: input.products.map((product) => ({ ...product, price_minor: 1000 })),
  };
  assert.equal(solveEdit(editInput(paid, zero), before, input, zero).status, 'infeasible');
  const quietInput = {
    ...input,
    answers: { ...input.answers, noise: 'quiet' },
    products: input.products.map((product) => ({
      ...product,
      noise_level: 0,
      has_bangs: false,
      has_crackle: false,
      has_whistle: false,
    })),
  };
  const quietBefore = solvePlan(quietInput).candidates[0];
  assert.equal(
    solveEdit(quietInput, quietBefore, quietInput, [{ op: 'set_noise', noise: 'quiet' }]).status,
    'infeasible',
  );
});
test('diff counts purchased units, preserves prices and totals, and ignores mere cue ordering', () => {
  const a = input.products[0];
  const b = input.products[1];
  const first = {
    cues: [{ product_id: a.product_id }, { product_id: a.product_id }],
    total_minor: 2 * a.price_minor,
  };
  const second = {
    cues: [{ product_id: a.product_id }, { product_id: b.product_id }],
    total_minor: a.price_minor + b.price_minor,
  };
  const diff = planDiff(first, second, { oldInput: input, newInput: input, names });
  assert.equal(diff.removed[0].quantity, 1);
  assert.equal(diff.added[0].quantity, 1);
  assert.equal(diff.total_before, first.total_minor);
  assert.equal(diff.total_after, second.total_minor);
  assert.deepEqual(
    planDiff(
      second,
      { ...second, cues: [...second.cues].reverse() },
      { oldInput: input, newInput: input, names },
    ).added,
    [],
  );
});
test('prepared history validates and unknown rules keep the exact old candidate and hash', () => {
  const prepared = prepareEdit(request, plan, input, names);
  assert.equal(prepared.edit.outcome, 'applied');
  assert.equal(
    savedEditSchema.safeParse({ ...prepared.edit, candidate_id: id, seq: 1 }).success,
    true,
  );
  const unknown = prepareEdit(
    { ...request, source: 'rule', message: 'do something clever' },
    plan,
    input,
    names,
  );
  assert.equal(unknown.candidate, null);
  assert.equal(unknown.edit.outcome, 'clarify');
  assert.equal(unknown.edit.input_hash, 'original');
  assert.equal(unknown.edit.diff, null);
  assert.equal(
    editRequestSchema.safeParse({ ...request, message: 'x'.repeat(301) }).success,
    false,
  );
  assert.equal(editRequestSchema.safeParse({ ...request, ops: [] }).success, false);
});
test('template title uses mood, headline product and occasion deterministically', () => {
  const title = showName(before, input, names);
  assert.ok(title.includes(input.answers.occasion));
  assert.ok(title.includes(names.get(before.cues.at(-1).product_id)));
  assert.equal(showName(before, input, names), title);
});

test('longer, crackle, finale, quieter and swap edits achieve their stated effect when stock allows', () => {
  const base = input.products[0];
  const products = [
    {
      ...base,
      price_minor: 1000,
      stock_qty: 10,
      noise_level: 0,
      has_bangs: false,
      has_crackle: false,
      energy: 0.1,
      duration_ms: 30000,
    },
    {
      ...base,
      product_id: input.products[1].product_id,
      price_minor: 1500,
      stock_qty: 10,
      noise_level: 2,
      has_bangs: false,
      has_crackle: true,
      energy: 0.7,
      duration_ms: 30000,
    },
  ];
  const snapshot = {
    ...input,
    answers: { ...input.answers, budget_minor: 8000, noise: 'normal', length_min: 2 },
    products,
  };
  const quietBefore = {
    cues: [{ product_id: products[0].product_id }],
    total_minor: 1000,
    duration_ms: 30000,
  };
  for (const message of ['Longer', 'More crackle', 'Bigger finale', 'Swap this firework']) {
    const ops = matchEdit(
      { source: 'chip', message, product: products[0].product_id },
      snapshot,
      quietBefore.total_minor,
    );
    const next = editInput(snapshot, ops);
    const result = solveEdit(next, quietBefore, snapshot, ops);
    assert.equal(result.status, 'ok', message);
    if (message === 'Longer') assert.ok(result.candidate.duration_ms > quietBefore.duration_ms);
    if (message === 'More crackle')
      assert.ok(result.candidate.cues.some((cue) => cue.product_id === products[1].product_id));
    if (message === 'Bigger finale') assert.equal(result.candidate.mood, 'big_finale');
    if (message === 'Swap this firework')
      assert.ok(result.candidate.cues.every((cue) => cue.product_id !== products[0].product_id));
  }
  const noisyBefore = { ...quietBefore, cues: [{ product_id: products[1].product_id }] };
  const ops = matchEdit({ source: 'chip', message: 'Quieter' }, snapshot, noisyBefore.total_minor);
  const result = solveEdit(editInput(snapshot, ops), noisyBefore, snapshot, ops);
  assert.equal(result.status, 'ok');
  assert.ok(result.candidate.cues.every((cue) => cue.product_id === products[0].product_id));
  assert.deepEqual(
    matchEdit(
      { source: 'rule', message: 'pet friendly' },
      { ...snapshot, answers: { ...snapshot.answers, noise: 'loud' } },
      1000,
    ),
    [{ op: 'set_noise', noise: 'quiet' }],
  );
});

test('swap requires a replacement unit, rather than merely deleting the requested product', () => {
  const base = input.products[0];
  const other = { ...input.products[1], price_minor: 1000, stock_qty: 1 };
  const snapshot = {
    ...input,
    answers: { ...input.answers, budget_minor: 10000 },
    products: [{ ...base, price_minor: 1000, stock_qty: 1 }, other],
  };
  const previous = {
    cues: [{ product_id: base.product_id }, { product_id: other.product_id }],
    total_minor: 2000,
    duration_ms: 10000,
  };
  const ops = [{ op: 'swap_product', product_id: base.product_id }];
  assert.equal(solveEdit(editInput(snapshot, ops), previous, snapshot, ops).status, 'infeasible');
});

test('fresh-stock edits retain a saved finale preference and previously excluded swap products', () => {
  const removed = input.products[0].product_id;
  const saved = {
    ...plan,
    solver_snapshot: { ...input, preferred_mood: 'big_finale' },
    plan_edits: [{ outcome: 'applied', ops: [{ op: 'swap_product', product_id: removed }] }],
  };
  const prepared = prepareEdit(request, saved, input, names);
  assert.equal(prepared.snapshot.preferred_mood, 'big_finale');
  assert.ok(prepared.snapshot.products.every((product) => product.product_id !== removed));
  assert.equal(saved.solver_snapshot.products.length, input.products.length);
});
