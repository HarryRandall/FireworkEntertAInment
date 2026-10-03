// Explicit edit pacing remains deterministic, hashable and constrained by the unchanged hard filters.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { solvePlan } from '../src/index.ts';
const input = JSON.parse(readFileSync(new URL('./fixtures/demo-store.json', import.meta.url)));
test('requested finale mood survives diversity selection and participates in cache identity', () => {
  const result = solvePlan({ ...input, preferred_mood: 'big_finale' }, { candidate_count: 10 });
  assert.equal(result.status, 'ok');
  assert.ok(result.candidates.every((candidate) => candidate.mood === 'big_finale'));
  assert.ok(
    result.candidates.every((candidate) => candidate.total_minor <= input.answers.budget_minor),
  );
  assert.notEqual(result.input_hash, solvePlan(input).input_hash);
  assert.deepEqual(
    solvePlan({ ...input, preferred_mood: 'big_finale' }, { candidate_count: 10 }),
    result,
  );
  assert.equal(solvePlan({ ...input, preferred_mood: 'unrecognised' }).status, 'invalid_input');
});
