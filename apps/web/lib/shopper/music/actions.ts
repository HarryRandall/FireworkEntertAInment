/** Cookie-bound soundtrack changes re-solve current stock and pin shared features transactionally. */
import 'server-only';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { SOLVER_VERSION, musicAnalysisSchema } from '@showcrafter/planner';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleSupabase } from '@/lib/supabase/service-role';
import { readPlan, readPlannerContext } from '../planner/readers';
import { plannerInput } from '../planner/adapter';
import { currentCandidate } from '../planner/progress';
import type { PlannerActionResult, SavedPlan } from '../planner/contracts';
import { readStoreById } from '../readers';
import { readSoundtrack } from './readers';
import { musicRequestSchema } from './contracts';
import { prepareMusic } from './preparation';
import { configuredMusicProvider } from './configured-provider';

/** Chooses, removes or retimes music for an owned displayed candidate; failures keep the previous show. */
export async function changeSoundtrack(raw: unknown): Promise<PlannerActionResult> {
  const parsed = musicRequestSchema.safeParse(raw);
  if (!parsed.success)
    return { status: 'invalid', message: 'Please reload before choosing music.' };
  const request = parsed.data;
  const client = createClient(await cookies());
  const identity = await client.auth.getUser();
  if (identity.error) throw identity.error;
  const plan = await readPlan(request.session);
  if (!plan) return { status: 'unavailable', message: 'This plan is unavailable.' };
  const candidate = currentCandidate(plan.plan_candidates);
  if (candidate.id !== request.candidate || candidate.revision !== request.revision)
    return {
      status: 'invalid',
      message: 'Your plan changed in another tab. Reload before choosing music.',
    };
  if (plan.solver !== SOLVER_VERSION) throw new Error('Saved solver version unavailable');
  const selection = await selectTrack(request, plan, identity.data.user.id);
  if (selection.status !== 'selected') return selection;
  return solveSoundtrack(plan, selection.track, identity.data.user.id);
}
async function solveSoundtrack(
  plan: SavedPlan,
  track: string | null,
  shopper: string,
): Promise<PlannerActionResult> {
  const store = await readStoreById(plan.store_id);
  const context = await readPlannerContext(plan.store_id);
  if (!store || !context) return { status: 'unavailable', message: 'This shop is unavailable.' };
  const age = plan.solver_snapshot.age_confirmation;
  if (!age) throw new Error('Saved age confirmation missing');
  const current = plannerInput(store, context, plan.solver_snapshot.answers, age.confirmed_at);
  const selected = await analysisForTrack(plan, track);
  const prepared = prepareMusic(
    plan,
    current,
    { track, music: selected?.analysis ?? null },
    new Map(store.products.map((product) => [product.product_id, product.name])),
  );
  if (prepared.status !== 'ok')
    return { status: 'infeasible', message: `${prepared.reason}. Your previous show is kept.` };
  return persistMusic(plan, shopper, prepared, { track, analysis: selected?.analysis_id ?? null });
}
async function persistMusic(
  plan: SavedPlan,
  shopper: string,
  prepared: Extract<ReturnType<typeof prepareMusic>, { status: 'ok' }>,
  selected: { track: string | null; analysis: string | null },
): Promise<PlannerActionResult> {
  const candidate = currentCandidate(plan.plan_candidates);
  const service = createServiceRoleSupabase();
  if (!service) throw new Error('Music service credentials missing');
  const result = await service.rpc('persist_plan_music', {
    p_shopper: shopper,
    p_session: plan.id,
    p_candidate: candidate.id,
    p_revision: candidate.revision,
    p_hash: plan.input_hash,
    p_snapshot: prepared.snapshot,
    p_result: prepared.candidate,
    p_track: selected.track ?? undefined,
    p_analysis: selected.analysis ?? undefined,
    p_next_hash: prepared.hash,
  });
  if (result.error) return musicFailure(result.error);
  const updated = await readPlan(plan.id);
  if (!updated) throw new Error('Updated music plan could not be read');
  return { status: 'ok', plan: updated };
}
async function analysisForTrack(plan: SavedPlan, track: string | null) {
  if (track === null) return null;
  // Existing pins remain stable even if a new algorithm becomes current.
  if (track === plan.soundtrack?.track_id) return readSoundtrack(plan.id);
  const client = createClient(await cookies());
  const result = await client.rpc('music_track_analysis', { p_session: plan.id, p_track: track });
  if (result.error) throw result.error;
  if (result.data === null) return null;
  return z
    .object({ analysis_id: z.string().uuid(), analysis: musicAnalysisSchema })
    .parse(result.data);
}
function musicFailure(error: {
  code: string;
  message: string;
}): Exclude<PlannerActionResult, { status: 'ok' }> {
  if (error.code === '40001')
    return {
      status: 'invalid',
      message: 'Your plan changed in another tab. Reload before choosing music.',
    };
  if (error.message === 'Planner rate limit reached')
    return {
      status: 'rate_limited',
      message: 'You have made a few changes quickly. Please try again later. Your show is kept.',
    };
  if (error.message === 'Track is unavailable')
    return {
      status: 'unavailable',
      message: 'This track is unavailable. Choose another soundtrack.',
    };
  throw new Error(error.message);
}

type MusicRequest = ReturnType<typeof musicRequestSchema.parse>;
type Selection =
  | { status: 'selected'; track: string | null }
  | Exclude<PlannerActionResult, { status: 'ok' }>;
async function selectTrack(
  request: MusicRequest,
  plan: SavedPlan,
  shopper: string,
): Promise<Selection> {
  const service = createServiceRoleSupabase();
  if (!service) throw new Error('Music service credentials missing');
  let track: string | null = null;
  if (request.refresh) {
    if (request.track !== plan.soundtrack?.provider_track_id)
      return { status: 'invalid', message: 'Please reload your soundtrack.' };
    track = currentCandidate(plan.plan_candidates).soundtrack_track_id;
  } else if (request.track !== null) {
    const provider = configuredMusicProvider();
    if (!provider)
      return {
        status: 'unavailable',
        message: 'Music search is not configured. You can keep planning without music.',
      };
    const metadata = await provider.track(request.track);
    if (!metadata)
      return {
        status: 'unavailable',
        message: 'This track is unavailable. Choose another soundtrack.',
      };
    const imported = await service.rpc('import_shopper_track', {
      p_shopper: shopper,
      p_session: plan.id,
      p_track: metadata,
    });
    if (imported.error) return musicFailure(imported.error);
    track = imported.data;
  }
  return { status: 'selected', track };
}
