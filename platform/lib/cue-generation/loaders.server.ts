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

const ANALYSIS_WAIT_TIMEOUT_MS = 20_000;
const ANALYSIS_WAIT_INTERVAL_MS = 1_000;

export type AnalysisJsonLoadResult =
  | { status: 'absent'; analysis: null }
  | { status: 'completed'; analysis: AnalyserResult }
  | { status: 'running'; analysis: null }
  | { status: 'failed'; analysis: null; errorMessage: string | null }
  | { status: 'missing'; analysis: null }
  | { status: 'empty'; analysis: null }
  | { status: 'timeout'; analysis: null };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function loadAnalysisState(
  supabase: AppSupabase,
  musicAnalysisId: string,
): Promise<AnalysisJsonLoadResult> {
  const { data, error } = await supabase
    .from('music_analyses')
    .select('analysis_json, status, error_message')
    .eq('id', musicAnalysisId)
    .maybeSingle();
  if (error) {
    console.error('[cue-generation] loadAnalysisJson failed:', error);
    return { status: 'missing', analysis: null };
  }
  if (!data) return { status: 'missing', analysis: null };
  if (data.status === 'failed') {
    return { status: 'failed', analysis: null, errorMessage: data.error_message };
  }
  if (data.status !== 'completed') return { status: 'running', analysis: null };
  if (!data.analysis_json) return { status: 'empty', analysis: null };
  return { status: 'completed', analysis: data.analysis_json as unknown as AnalyserResult };
}

/** Loads the completed analyser JSON, or `null` if the analysis isn't ready. */
export async function loadAnalysisJson(
  supabase: AppSupabase,
  musicAnalysisId: string,
): Promise<AnalyserResult | null> {
  const result = await loadAnalysisState(supabase, musicAnalysisId);
  return result.status === 'completed' ? result.analysis : null;
}

/**
 * Waits briefly for upload-scoped analysis so Generate does not silently fall
 * back to a synthetic beat grid while the hidden analyser is still running.
 */
export async function waitForAnalysisJson(
  supabase: AppSupabase,
  musicAnalysisId: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<AnalysisJsonLoadResult> {
  const timeoutMs = options.timeoutMs ?? ANALYSIS_WAIT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? ANALYSIS_WAIT_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const result = await loadAnalysisState(supabase, musicAnalysisId);
    if (result.status !== 'running') return result;
    if (Date.now() >= deadline) return { status: 'timeout', analysis: null };
    await sleep(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
  }
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
