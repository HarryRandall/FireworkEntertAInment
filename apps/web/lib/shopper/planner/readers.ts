/** Cookie-bound owned history and public planner facts retain read failures. */
import 'server-only';
import { readSoundtrack } from '../music/readers';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { plannerContextSchema, savedPlanSchema } from './contracts';

/** Reads the public planning facts for one already-visible store. */
export async function readPlannerContext(store: string) {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('planner_context', { p_store: store });
  if (error) throw error;
  return data === null ? null : plannerContextSchema.parse(data);
}
/** Reads one session through shopper RLS; another shopper's UUID returns null. */
export async function readPlan(id: string) {
  const client = createClient(await cookies());
  const { data, error } = await client
    .from('plan_sessions')
    .select(
      'id,store_id,solver,input_hash,solver_snapshot,plan_candidates(id,rank,revision,soundtrack_track_id,soundtrack_analysis_id,name,mood,cues,total_minor,currency,duration_ms),plan_edits(id,candidate_id,seq,message,source,ops,diff,outcome,reply)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data === null
    ? null
    : savedPlanSchema.parse({ ...data, soundtrack: await readSoundtrack(id) });
}
