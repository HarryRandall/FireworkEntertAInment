/** Authenticated non-AI edits re-read public stock and atomically persist verified solver results. */
'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SOLVER_VERSION } from '@showcrafter/planner';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleSupabase } from '@/lib/supabase/service-role';
import { readStoreById } from '../readers';
import { plannerInput } from './adapter';
import { readPlan, readPlannerContext } from './readers';
import { currentCandidate } from './progress';
import { editRequestSchema, type EditRequest } from './edit-contracts';
import { prepareEdit } from './edit-preparation';
import type { SavedPlan, PlannerActionResult } from './contracts';

/** Validates ownership and the displayed revision before generating any trusted edit operations. */
export async function editPlan(raw: unknown): Promise<PlannerActionResult> {
  const parsed = editRequestSchema.safeParse(raw);
  if (!parsed.success)
    return { status: 'invalid', message: 'Use a supported change of up to 300 characters.' };
  const client = createClient(await cookies());
  const identity = await client.auth.getUser();
  if (identity.error) throw identity.error;
  const plan = await readPlan(parsed.data.session);
  if (!plan) return { status: 'unavailable', message: 'This plan is unavailable.' };
  const request = parsed.data;
  if (plan.plan_edits.some((edit) => edit.id === request.id)) return { status: 'ok', plan };
  const candidate = currentCandidate(plan.plan_candidates);
  const seq = Math.max(0, ...plan.plan_edits.map((edit) => edit.seq)) + 1;
  if (
    candidate.id !== request.candidate ||
    candidate.revision !== request.revision ||
    seq !== request.seq
  )
    return {
      status: 'invalid',
      message: 'Your plan changed in another tab. Reload before editing.',
    };
  if (plan.solver !== SOLVER_VERSION) throw new Error('Saved solver version unavailable');
  if (!validSwap(request, plan))
    return { status: 'invalid', message: 'Choose a firework in this show to swap.' };
  return applyEdit(request, plan, identity.data.user.id);
}
async function applyEdit(
  request: EditRequest,
  plan: SavedPlan,
  shopper: string,
): Promise<PlannerActionResult> {
  const store = await readStoreById(plan.store_id);
  const context = await readPlannerContext(plan.store_id);
  if (!store || !context) return { status: 'unavailable', message: 'This shop is unavailable.' };
  const age = plan.solver_snapshot.age_confirmation;
  if (!age) throw new Error('Saved age confirmation missing');
  const current = plannerInput(store, context, plan.solver_snapshot.answers, age.confirmed_at);
  const names = new Map(store.products.map((product) => [product.product_id, product.name]));
  const prepared = prepareEdit(request, plan, current, names);
  const result = await persistEdit(request, plan, shopper, prepared);
  if (result.status !== 'ok') return result;
  revalidatePath(`/shopper/stores/${store.store.slug}/plan`);
  return result;
}
function validSwap(request: EditRequest, plan: SavedPlan) {
  if (request.product === undefined) return true;
  return currentCandidate(plan.plan_candidates).cues.some(
    (cue) => cue.product_id === request.product,
  );
}
async function persistEdit(
  request: EditRequest,
  plan: SavedPlan,
  shopper: string,
  prepared: ReturnType<typeof prepareEdit>,
): Promise<PlannerActionResult> {
  const before = currentCandidate(plan.plan_candidates);
  const service = createServiceRoleSupabase();
  if (!service) throw new Error('Planner service credentials missing');
  const { error } = await service.rpc('persist_plan_edit', {
    p_shopper: shopper,
    p_session: plan.id,
    p_candidate: before.id,
    p_revision: request.revision,
    p_seq: request.seq,
    p_hash: plan.input_hash,
    p_edit: prepared.edit,
    p_snapshot: prepared.snapshot,
    p_result: prepared.candidate,
  });
  if (error) {
    if (error.code === '40001')
      return {
        status: 'invalid',
        message: 'Your plan changed in another tab. Reload before editing.',
      };
    if (error.message === 'Planner rate limit reached')
      return {
        status: 'rate_limited',
        message: 'You have made a few changes quickly. Please try again later. Your show is kept.',
      };
    throw new Error(error.message);
  }
  const updated = await readPlan(plan.id);
  if (!updated) throw new Error('Edited plan could not be read');
  return { status: 'ok', plan: updated };
}
