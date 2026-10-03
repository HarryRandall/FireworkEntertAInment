/** Pure soundtrack replanning preserves accumulated chip constraints and immutable input clocks. */
import { solvePlan, type PlannerInput } from '@showcrafter/planner';
import type { SavedPlan } from '../planner/contracts';
import { showName } from '../planner/names';

const MUSIC_CANDIDATE_COUNT = 10; // Same bounded diverse search prefix used for planner edits.
/** Applies an optional track and features to current stock without mutating the saved plan.
 * Track identity is a UUID; feature clocks are seconds from audio start, cue clocks milliseconds. */
export function prepareMusic(
  plan: SavedPlan,
  current: PlannerInput,
  selected: { track: string | null; music: PlannerInput['music'] },
  names: ReadonlyMap<string, string>,
) {
  const swapped = plan.plan_edits
    .filter((edit) => edit.outcome === 'applied')
    .flatMap((edit) => edit.ops)
    .flatMap((op) => (op.op === 'swap_product' ? [op.product_id] : []));
  const snapshot: PlannerInput = {
    ...current,
    answers: { ...current.answers, soundtrack: selected.track },
    music: selected.music,
    preferred_mood: plan.solver_snapshot.preferred_mood,
    products: current.products.filter((product) => !swapped.includes(product.product_id)),
  };
  const result = solvePlan(snapshot, { candidate_count: MUSIC_CANDIDATE_COUNT });
  if (result.status === 'invalid_input') throw new Error(result.issues.join('; '));
  if (result.status === 'infeasible') return result;
  const candidate =
    result.candidates.find((item) => item.mood === snapshot.preferred_mood) ??
    result.candidates.at(0);
  if (!candidate) throw new Error('Music solve returned no candidate');
  return {
    status: 'ok' as const,
    snapshot,
    hash: result.input_hash,
    candidate: { ...candidate, name: showName(candidate, snapshot, names) },
  };
}
