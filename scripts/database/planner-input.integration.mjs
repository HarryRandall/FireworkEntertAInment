// Read-only acceptance of real seeded public RPCs through the app adapter and solver.
import assert from 'node:assert/strict';
import { solvePlan } from '../../packages/planner/src/index.ts';
import { storePageSchema } from '../../apps/web/lib/shopper/contracts.ts';
import { plannerContextSchema } from '../../apps/web/lib/shopper/planner/contracts.ts';
import { plannerInput } from '../../apps/web/lib/shopper/planner/adapter.ts';
import { defaultAnswers } from '../../apps/web/lib/shopper/planner/progress.ts';

/** Checks seeded shop inputs and diverse candidates without creating sessions or spending credits. */
export async function verifyPlannerInputs(client) {
  for (const slug of ['leeds', 'york']) {
    const { data, error } = await client.rpc('store_page_by_slug', { p_slug: slug });
    assert.equal(error, null);
    const store = storePageSchema.parse(data);
    const facts = await client.rpc('planner_context', { p_store: store.store.id });
    assert.equal(facts.error, null);
    const context = plannerContextSchema.parse(facts.data);
    const input = plannerInput(
      store,
      context,
      defaultAnswers(context.market.currency),
      new Date().toISOString(),
    );
    const result = solvePlan(input, { candidate_count: 3 });
    assert.equal(result.status, 'ok', JSON.stringify(result));
    assert.ok(result.candidates.length > 1);
    assert.ok(
      result.candidates.every((candidate) => candidate.total_minor <= input.answers.budget_minor),
    );
  }
  console.log('Seeded Leeds and York public snapshots produce diverse, budget-safe plans.');
}
