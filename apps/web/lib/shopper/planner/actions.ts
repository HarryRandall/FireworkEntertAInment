/** Authenticated server-only solver orchestration and atomic trusted persistence. */
'use server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  solvePlan,
  SOLVER_VERSION,
  type PlannerInput,
  type PlanCandidate,
} from '@showcrafter/planner';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleSupabase } from '@/lib/supabase/service-role';
import { readStore, readStoreById } from '../readers';
import { plannerInput } from './adapter';
import { showName } from './names';
import { readPlan, readPlannerContext } from './readers';
import { startRequestSchema, PLANNER_LIMITS, type PlannerActionResult } from './contracts';

async function shopperIdentity() {
  const client = createClient(await cookies());
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user.id;
}
function expectedFailure(error: { message: string; code: string }): PlannerActionResult {
  if (error.message === 'Insufficient planning credits')
    return {
      status: 'unavailable',
      message:
        "This shop's planner is unavailable. Browse the shop or ask staff to help you choose.",
    };
  if (error.message === 'Planner rate limit reached')
    return {
      status: 'rate_limited',
      message: 'You have planned a few shows quickly. Please try again later.',
    };
  throw new Error(error.message);
}
async function persist({
  shopper,
  session,
  input,
  hash,
  candidate,
  qr,
  names,
}: {
  shopper: string;
  session: string;
  input: PlannerInput;
  hash: string;
  candidate: PlanCandidate;
  qr: string | null;
  names: ReadonlyMap<string, string>;
}): Promise<PlannerActionResult> {
  const service = createServiceRoleSupabase();
  if (!service) throw new Error('Planner service credentials missing');
  const { error } = await service.rpc('persist_planner_result', {
    p_shopper: shopper,
    p_session: session,
    p_store: input.store_id,
    p_snapshot: input,
    p_hash: hash,
    p_solver: SOLVER_VERSION,
    p_candidate: { ...candidate, name: showName(candidate, input, names) },
    p_qr: qr ?? undefined,
  });
  if (error) return expectedFailure(error);
  const plan = await readPlan(session);
  if (!plan) throw new Error('Persisted plan could not be read');
  return { status: 'ok', plan };
}
/** Solves current store stock before charging; a repeated request returns its owned saved plan. */
export async function startPlanning(raw: unknown): Promise<PlannerActionResult> {
  const request = startRequestSchema.safeParse(raw);
  if (!request.success)
    return { status: 'invalid', message: 'Please check your planning answers.' };
  const shopper = await shopperIdentity();
  const { slug, answers, age, qr } = request.data;
  if (Date.parse(age) > Date.now())
    return { status: 'invalid', message: 'Please confirm your age again.' };
  const store = await readStore(slug);
  if (!store) return { status: 'unavailable', message: 'This shop is unavailable.' };
  const existing = await readPlan(request.data.request);
  if (existing) {
    if (existing.store_id !== store.store.id) throw new Error('Session store mismatch');
    return { status: 'ok', plan: existing };
  }
  const context = await readPlannerContext(store.store.id);
  if (!context) throw new Error('Planner context missing');
  const input = plannerInput(store, context, answers, age);
  const result = solvePlan(input);
  if (result.status === 'invalid_input') throw new Error(result.issues.join('; '));
  if (result.status === 'infeasible') return { status: 'infeasible', message: result.reason };
  const candidate = result.candidates.at(0);
  if (!candidate) throw new Error('Solver returned no candidate');
  return persist({
    shopper,
    session: request.data.request,
    input,
    hash: result.input_hash,
    candidate,
    qr,
    names: new Map(store.products.map((product) => [product.product_id, product.name])),
  });
}
/** Adds only the next diverse rank using the owned immutable snapshot, without a new charge. */
export async function differentPlan(raw: unknown): Promise<PlannerActionResult> {
  const request = z
    .object({
      session: z.string().uuid(),
      rank: z.number().int().positive().max(PLANNER_LIMITS.maxCandidates),
    })
    .strict()
    .safeParse(raw);
  if (!request.success) return { status: 'invalid', message: 'Please reload your plan.' };
  const shopper = await shopperIdentity();
  const plan = await readPlan(request.data.session);
  if (!plan) return { status: 'unavailable', message: 'This plan is unavailable.' };
  if (plan.solver !== SOLVER_VERSION) throw new Error('Saved solver version unavailable');
  const count = request.data.rank + 1;
  if (count > PLANNER_LIMITS.maxCandidates)
    return {
      status: 'exhausted',
      message: 'You have seen all the different plans that fit these answers.',
    };
  const result = solvePlan(plan.solver_snapshot, { candidate_count: count });
  if (result.status !== 'ok') throw new Error('Saved plan cannot be reproduced');
  const candidate = result.candidates.find((item) => item.rank === count);
  if (!candidate)
    return {
      status: 'exhausted',
      message: 'There are no more different plans that fit. You can keep this show.',
    };
  const store = await readStoreById(plan.store_id);
  if (!store) return { status: 'unavailable', message: 'This shop is unavailable.' };
  return persist({
    shopper,
    session: plan.id,
    input: plan.solver_snapshot,
    hash: plan.input_hash,
    candidate,
    qr: null,
    names: new Map(store.products.map((product) => [product.product_id, product.name])),
  });
}
