/**
 * Database loaders + status writers for the cue generator.
 *
 * Reads use the user-scoped Supabase client so RLS still applies; writes also
 * scope by `user_id` for defence-in-depth. Cache invalidation + path
 * revalidation happens here so the runner can stay synchronous-looking.
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/lib/database.types';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { invalidateShowCacheForUser } from '@/lib/shows.server';
import type { ShowBriefRow } from './schemas';

type AppSupabase = SupabaseClient<Database>;

/** Loads the slim show "brief" used to build the LLM prompt. */
export async function loadBrief(
  supabase: AppSupabase,
  userId: string,
  showId: string,
): Promise<ShowBriefRow | null> {
  const { data, error } = await supabase
    .from('shows')
    .select(
      'id, slug, title, description, duration_seconds, budget_cents, time_of_day, location, mood_tags, music_analysis_id',
    )
    .eq('id', showId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[cue-generation] loadBrief failed:', error);
    return null;
  }
  return (data as ShowBriefRow) ?? null;
}

/** Loads the completed analyser JSON, or `null` if the analysis isn't ready. */
export async function loadAnalysisJson(
  supabase: AppSupabase,
  musicAnalysisId: string,
): Promise<AnalyserResult | null> {
  const { data, error } = await supabase
    .from('music_analyses')
    .select('analysis_json, status')
    .eq('id', musicAnalysisId)
    .maybeSingle();
  if (error) {
    console.error('[cue-generation] loadAnalysisJson failed:', error);
    return null;
  }
  if (data?.status !== 'completed') return null;
  if (!data?.analysis_json) return null;
  return data.analysis_json as unknown as AnalyserResult;
}

/**
 * Writes a `generation_status` patch on the show row, then invalidates caches
 * and revalidates the show / preview / generating routes so polling clients
 * see the new status without hard refresh.
 */
export async function markGenerationStatus(
  supabase: AppSupabase,
  userId: string,
  showId: string,
  patch: Database['public']['Tables']['shows']['Update'],
) {
  const { error } = await supabase
    .from('shows')
    .update(patch)
    .eq('id', showId)
    .eq('user_id', userId);
  if (error) {
    console.error('[cue-generation] status update failed:', error);
    return;
  }
  const { data: show } = await supabase
    .from('shows')
    .select('slug')
    .eq('id', showId)
    .eq('user_id', userId)
    .maybeSingle();
  await invalidateShowCacheForUser(userId, {
    showId,
    showSlug: show?.slug ?? null,
  });
  if (show?.slug) {
    revalidatePath(`/shows/${show.slug}`);
    revalidatePath(`/shows/${show.slug}/generating`);
    revalidatePath(`/shows/${show.slug}/preview`);
  }
}
