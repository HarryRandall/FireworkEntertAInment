/** Computes purchased-unit changes, retaining product names and price snapshots in history. */
import type { PlannerInput } from '@showcrafter/planner';
import type { z } from 'zod';
import type { editDiffSchema } from './edit-contracts';

type Candidate = { cues: { product_id: string }[]; total_minor: number };
function counts(candidate: Candidate) {
  const quantities = new Map<string, number>();
  for (const cue of candidate.cues)
    quantities.set(cue.product_id, (quantities.get(cue.product_id) ?? 0) + 1);
  return quantities;
}
/** Returns added/removed quantity deltas and exact totals in minor units; does not mutate either plan. */
export function planDiff(
  before: Candidate,
  after: Candidate,
  context: { oldInput: PlannerInput; newInput: PlannerInput; names: ReadonlyMap<string, string> },
): z.infer<typeof editDiffSchema> {
  const { oldInput, newInput, names } = context;
  const oldCounts = counts(before);
  const newCounts = counts(after);
  const added: z.infer<typeof editDiffSchema>['added'] = [];
  const removed: z.infer<typeof editDiffSchema>['removed'] = [];
  for (const id of new Set([...oldCounts.keys(), ...newCounts.keys()])) {
    const delta = (newCounts.get(id) ?? 0) - (oldCounts.get(id) ?? 0);
    if (delta === 0) continue;
    const product = (delta > 0 ? newInput : oldInput).products.find(
      (item) => item.product_id === id,
    );
    if (!product) throw new Error('Diff product missing from trusted snapshot');
    const item = {
      product_id: id,
      name: names.get(id) ?? 'Unavailable firework',
      quantity: Math.abs(delta),
      unit_price_minor: product.price_minor,
    };
    (delta > 0 ? added : removed).push(item);
  }
  return {
    added,
    removed,
    total_before: before.total_minor,
    total_after: after.total_minor,
    currency: oldInput.answers.currency,
  };
}
