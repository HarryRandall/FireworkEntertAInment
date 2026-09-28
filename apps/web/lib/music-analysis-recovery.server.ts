import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { runMusicAnalysisForUpload } from '@/lib/show-analysis-runner.server';
import { generateCuesForShow } from '@/lib/cue-generation/runner.server';
import { markLinkedShowGenerationFailed } from '@/lib/music-analysis-lifecycle.server';

/** One explicit recovery pass. Leases fence concurrent clicks and callbacks. */
export async function recoverMusicAnalysisWork(supabase: SupabaseClient<Database>) {
  const expired = await supabase.rpc('expire_exhausted_song_analyses', {
    p_limit: 10,
    p_max_attempts: 3,
  });
  if (expired.error)
    throw new Error('Could not expire exhausted analysis work.', { cause: expired.error });
  for (const row of expired.data ?? []) {
    await markLinkedShowGenerationFailed({
      supabase,
      userId: row.user_id,
      musicAnalysisId: row.analysis_id,
      error: row.error_message,
    });
  }
  const expiredCues = await supabase.rpc('expire_exhausted_cue_generations', {
    p_limit: 10,
    p_max_attempts: 3,
  });
  if (expiredCues.error)
    throw new Error('Could not expire exhausted cue work.', { cause: expiredCues.error });
  const analysis = await runMusicAnalysisForUpload({ supabase });
  if (
    !analysis.ok &&
    !analysis.pending &&
    !analysis.cancelled &&
    analysis.userId &&
    analysis.analysisId
  ) {
    await markLinkedShowGenerationFailed({
      supabase,
      userId: analysis.userId,
      musicAnalysisId: analysis.analysisId,
      error: analysis.error,
    });
  }
  const cues = await generateCuesForShow({ supabase });
  return {
    ok: Boolean((analysis.ok || analysis.pending || analysis.cancelled) && cues.ok),
    expiredAnalyses: expired.data?.length ?? 0,
    expiredCues: expiredCues.data?.length ?? 0,
    analysis: analysis.ok
      ? 'completed'
      : analysis.idle
        ? 'idle'
        : analysis.pending
          ? 'pending'
          : analysis.cancelled
            ? 'cancelled'
            : 'failed',
    cues: cues.ok
      ? 'pending' in cues
        ? cues.reason === 'no_generation_ready'
          ? 'idle'
          : 'pending'
        : 'completed'
      : 'failed',
  };
}
