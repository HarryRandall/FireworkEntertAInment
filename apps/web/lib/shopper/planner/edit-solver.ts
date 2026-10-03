/** Re-solves structured requests and checks their actual effect before claiming success. */
import { solvePlan, type PlanCandidate, type PlannerInput } from '@showcrafter/planner';
import type { EditOp } from './edit-contracts';

// Inspect the solver's complete bounded diverse prefix, favouring the smallest assortment change.
const EDIT_CANDIDATE_COUNT = 10;
type Before = Pick<PlanCandidate, 'total_minor' | 'duration_ms'> & {
  cues: { product_id: string }[];
};
/** Applies constraints to a new snapshot; clocks remain milliseconds, budgets minor units, stock never reserved. */
export function editInput(input: PlannerInput, ops: readonly EditOp[]): PlannerInput {
  const next = structuredClone(input);
  for (const op of ops) {
    switch (op.op) {
      case 'set_budget':
        next.answers.budget_minor = Math.min(op.max_minor, input.answers.budget_minor);
        break;
      case 'set_length':
        next.answers.length_min = op.length_min;
        break;
      case 'set_noise':
        next.answers.noise = op.noise;
        break;
      case 'more':
        if (op.attribute === 'crackle')
          next.answers.looks = [...new Set([...next.answers.looks, 'Crackle'])];
        else next.preferred_mood = 'big_finale';
        break;
      case 'swap_product':
        next.products = next.products.filter((product) => product.product_id !== op.product_id);
        break;
    }
  }
  return next;
}
/** Returns a candidate/hash or infeasibility reason only after checking the requested effect. Inputs are unchanged; clocks are ms from show start and prices minor units. */
export function solveEdit(
  input: PlannerInput,
  before: Before,
  oldInput: PlannerInput,
  ops: readonly EditOp[],
) {
  const result = solvePlan(input, { candidate_count: EDIT_CANDIDATE_COUNT });
  if (result.status === 'invalid_input') throw new Error(result.issues.join('; '));
  if (result.status === 'infeasible')
    return { status: 'infeasible' as const, reason: result.reason };
  const candidates = result.candidates.filter((candidate) =>
    ops.every((op) => fulfils(op, candidate, { before, input, oldInput })),
  );
  candidates.sort((left, right) => changeCount(before, left) - changeCount(before, right));
  const candidate = candidates.at(0);
  return candidate
    ? { status: 'ok' as const, candidate, input_hash: result.input_hash }
    : {
        status: 'infeasible' as const,
        reason:
          'No result in the planner search achieves this change within the current budget, stock, noise and garden limits.',
      };
}
function fulfils(
  op: EditOp,
  candidate: PlanCandidate,
  context: { before: Before; input: PlannerInput; oldInput: PlannerInput },
) {
  const { before, input, oldInput } = context;
  switch (op.op) {
    case 'set_budget':
      return candidate.total_minor <= op.max_minor && candidate.total_minor < before.total_minor;
    case 'set_length':
      return candidate.duration_ms > before.duration_ms;
    case 'swap_product':
      return (
        !candidate.cues.some((cue) => cue.product_id === op.product_id) &&
        hasReplacement(before, candidate)
      );
    case 'set_noise':
      return noise(candidate, input) < noise(before, oldInput);
    case 'more':
      return op.attribute === 'crackle'
        ? crackle(candidate, input) > crackle(before, oldInput)
        : headlineEnergy(candidate, input) > headlineEnergy(before, oldInput) &&
            candidate.mood === 'big_finale';
  }
}
function crackle(candidate: Before, input: PlannerInput) {
  return candidate.cues.filter(
    (cue) =>
      input.products.find((product) => product.product_id === cue.product_id)?.has_crackle === true,
  ).length;
}
function noise(candidate: Before, input: PlannerInput) {
  return Math.max(
    ...candidate.cues.map(
      (cue) =>
        input.products.find((product) => product.product_id === cue.product_id)?.noise_level ?? 0,
    ),
  );
}
function headlineEnergy(candidate: Before, input: PlannerInput) {
  return (
    input.products.find((product) => product.product_id === candidate.cues.at(-1)?.product_id)
      ?.energy ?? 0
  );
}
function changeCount(before: Before, after: Before) {
  const quantities = new Map<string, number>();
  for (const cue of before.cues)
    quantities.set(cue.product_id, (quantities.get(cue.product_id) ?? 0) + 1);
  for (const cue of after.cues)
    quantities.set(cue.product_id, (quantities.get(cue.product_id) ?? 0) - 1);
  return [...quantities.values()].reduce((sum, quantity) => sum + Math.abs(quantity), 0);
}

function hasReplacement(before: Before, after: Before) {
  const original = new Map<string, number>();
  for (const cue of before.cues)
    original.set(cue.product_id, (original.get(cue.product_id) ?? 0) + 1);
  for (const cue of after.cues) {
    const remaining = original.get(cue.product_id) ?? 0;
    if (remaining === 0) return true;
    original.set(cue.product_id, remaining - 1);
  }
  return false;
}
