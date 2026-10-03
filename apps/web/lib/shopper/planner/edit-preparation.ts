/** Pure preparation of solver-verified edits, replies and immutable history documents. */
import type { PlannerInput } from '@showcrafter/planner';
import type { SavedPlan } from './contracts';
import type { EditRequest } from './edit-contracts';
import { matchEdit } from './edit-rules';
import { editInput, solveEdit } from './edit-solver';
import { planDiff } from './edit-diff';
import { showName } from './names';
import { currentCandidate } from './progress';
import { formatPrice } from '../paths';

/** Computes an edit without mutating saved state; failed requests have no candidate or diff. */
export function prepareEdit(
  request: EditRequest,
  plan: SavedPlan,
  current: PlannerInput,
  names: ReadonlyMap<string, string>,
) {
  const swapped = plan.plan_edits
    .filter((edit) => edit.outcome === 'applied')
    .flatMap((edit) => edit.ops)
    .flatMap((op) => (op.op === 'swap_product' ? [op.product_id] : []));
  const input = {
    ...current,
    preferred_mood: plan.solver_snapshot.preferred_mood,
    products: current.products.filter((product) => !swapped.includes(product.product_id)),
  };
  const before = currentCandidate(plan.plan_candidates);
  const ops = matchEdit(request, input, before.total_minor);
  const snapshot = editInput(input, ops);
  const result = ops.length > 0 ? solveEdit(snapshot, before, plan.solver_snapshot, ops) : null;
  const candidate =
    result?.status === 'ok'
      ? { ...result.candidate, name: showName(result.candidate, snapshot, names) }
      : null;
  const edit = {
    id: request.id,
    source: request.source,
    message: request.message,
    ops,
    outcome: outcome(result),
    reply: reply(request.message, snapshot, result),
    diff: candidate
      ? planDiff(before, candidate, { oldInput: plan.solver_snapshot, newInput: snapshot, names })
      : null,
    input_hash: result?.status === 'ok' ? result.input_hash : plan.input_hash,
  };
  return { edit, snapshot, candidate };
}
type Result = ReturnType<typeof solveEdit> | null;
function outcome(result: Result) {
  if (!result) return 'clarify';
  return result.status === 'ok' ? 'applied' : 'infeasible';
}
function reply(message: string, input: PlannerInput, result: Result) {
  if (!result)
    return 'Try a chip, or a phrase such as "make it longer", "pet friendly" or "under 100". Ask for one change at a time.';
  if (result.status === 'ok') return 'Changed your show. Here is what changed.';
  return `Could not apply '${message}' under ${formatPrice(input.answers.budget_minor, input.answers.currency)}. ${result.reason}. Your show is kept.`;
}
