import { NextResponse } from 'next/server';
import { authoriseAnalyserCallback } from '@/lib/analyser-callback-auth';
import { createServiceRoleSupabase } from '@/lib/supabase/service-role';
import { recoverMusicAnalysisWork } from '@/lib/music-analysis-recovery.server';

export const maxDuration = 300;

/** Explicit recovery API for trusted callers. No recurring scheduler invokes it. */
export async function POST(request: Request) {
  if (
    !authoriseAnalyserCallback(
      request.headers.get('authorization'),
      process.env.ANALYSER_SHARED_SECRET,
    )
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!process.env.ANALYSER_DISPATCH_URL?.trim())
    return NextResponse.json({ ok: false }, { status: 503 });
  const supabase = createServiceRoleSupabase();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const result = await recoverMusicAnalysisWork(supabase);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
