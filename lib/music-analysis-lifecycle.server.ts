import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { generateCuesForShow } from '@/lib/cue-generation.server';
import { runMusicAnalysisForUpload } from '@/lib/show-analysis-runner.server';

type AppSupabaseClient = SupabaseClient<Database>;

function deadlineReached(value: string | null): boolean {
  if (!value) return true;
  const deadline = Date.parse(value);
  return Number.isFinite(deadline) && deadline <= Date.now();
}

export async function recoverPublicAssortmentShowGeneration(params: {
  supabase: AppSupabaseClient;
  userId: string;
  showId: string;
  musicAnalysisId: string;
}) {
  const { data: analysis, error } = await params.supabase
    .from('song_analyses')
    .select('status, lease_expires_at, next_retry_at')
    .eq('id', params.musicAnalysisId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not inspect public show analysis recovery: ${error.message}`);
  }
  if (!analysis) return;

  let analysisIsTerminal = analysis.status === 'completed' || analysis.status === 'failed';
  const analysisIsClaimable =
    analysis.status === 'running' &&
    deadlineReached(analysis.lease_expires_at) &&
    deadlineReached(analysis.next_retry_at);

  if (analysisIsClaimable) {
    const result = await runMusicAnalysisForUpload({
      supabase: params.supabase,
      userId: params.userId,
      analysisId: params.musicAnalysisId,
      personality: 'balanced',
    });
    analysisIsTerminal = result.ok || (!result.pending && !result.cancelled);
  }

  if (!analysisIsTerminal) return;

  const cueResult = await generateCuesForShow({
    supabase: params.supabase,
    userId: params.userId,
    showId: params.showId,
    musicAnalysisId: params.musicAnalysisId,
  });
  if (!cueResult.ok) {
    console.error('[assortment-qr] public show recovery failed:', cueResult.error);
  }
}

async function listRunningShowsForAnalysis(params: {
  supabase: AppSupabaseClient;
  userId: string;
  musicAnalysisId: string;
}) {
  const { data: shows, error } = await params.supabase
    .from('shows')
    .select('id, selected_cue_model')
    .eq('user_id', params.userId)
    .eq('music_analysis_id', params.musicAnalysisId)
    .eq('generation_status', 'running')
    .is('generation_completed_at', null);

  if (error) {
    console.error('[music-analysis-lifecycle] linked show lookup failed:', error);
    throw new Error('Could not load shows waiting for music analysis.');
  }

  return shows ?? [];
}

export async function resumeCueGenerationForCompletedAnalysis(params: {
  supabase: AppSupabaseClient;
  userId: string;
  musicAnalysisId: string;
}) {
  const shows = await listRunningShowsForAnalysis(params);

  for (const show of shows) {
    const result = await generateCuesForShow({
      supabase: params.supabase,
      userId: params.userId,
      showId: show.id,
      musicAnalysisId: params.musicAnalysisId,
      selectedCueModel: show.selected_cue_model,
    });

    if (!result.ok) {
      console.error('[music-analysis-lifecycle] resumed cue generation failed:', result.error);
    }
  }
}

export async function markLinkedShowGenerationFailed(params: {
  supabase: AppSupabaseClient;
  userId: string;
  musicAnalysisId: string;
  error: string;
}) {
  const shows = await listRunningShowsForAnalysis(params);
  const message = `Music analysis failed: ${params.error}`;

  for (const show of shows) {
    const { data: failed, error } = await params.supabase.rpc('fail_waiting_show_generation', {
      p_show_id: show.id,
      p_error_message: message,
    });
    if (error || !failed) {
      throw new Error(
        `Could not fail show generation ${show.id}: ${error?.message ?? 'row was not updated'}`,
      );
    }
  }
}
