import { NextResponse } from 'next/server';
import { authoriseAnalyserCallback } from '@/lib/analyser-callback-auth';
import { createServiceRoleSupabase } from '@/lib/supabase/service-role';
import { runMusicAnalysisForUpload } from '@/lib/show-analysis-runner.server';
import { generateCuesForShow } from '@/lib/cue-generation/runner.server';
import { markLinkedShowGenerationFailed } from '@/lib/music-analysis-lifecycle.server';

export const maxDuration = 300;

/** Modal's scheduler recovers leased work without touching audio retention. */
export async function POST(request: Request) {
  if (
    !authoriseAnalyserCallback(
      request.headers.get('authorization'),
      process.env.ANALYSER_SHARED_SECRET,
    )
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  // The scheduled path must dispatch promptly, never wait for a synchronous analyser.
  if (!process.env.ANALYSER_DISPATCH_URL) return NextResponse.json({ ok: false }, { status: 503 });
  const supabase = createServiceRoleSupabase();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
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
  const ok = (analysis.ok || analysis.pending || analysis.cancelled) && cues.ok;
  return NextResponse.json(
    {
      ok,
      analysis: analysis.ok
        ? 'completed'
        : analysis.idle
          ? 'idle'
          : analysis.pending
            ? 'pending'
            : 'failed',
      cues: cues.ok ? ('pending' in cues ? 'pending' : 'completed') : 'failed',
    },
    { status: ok ? 200 : 500 },
  );
}
