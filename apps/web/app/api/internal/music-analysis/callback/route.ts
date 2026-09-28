import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { authoriseAnalyserCallback } from '@/lib/analyser-callback-auth';
import { readResponseTextWithLimit, ResponseBodyTooLargeError } from '@/lib/bounded-response';
import { finishQueuedMusicAnalysis } from '@/lib/show-analysis-runner.server';
import { parseAnalyserResult, AnalyserOutputValidationError } from '@/lib/show-analysis-validation';
import {
  markLinkedShowGenerationFailed,
  resumeCueGenerationForCompletedAnalysis,
} from '@/lib/music-analysis-lifecycle.server';
import { createServiceRoleSupabase } from '@/lib/supabase/service-role';

export const maxDuration = 300;
const Base = {
  analysis_id: z.uuid(),
  lease_token: z.uuid(),
  runtime_ms: z.number().int().min(0).max(2147483647),
};
const Callback = z.discriminatedUnion('ok', [
  z.object({ ...Base, ok: z.literal(true), analysis: z.unknown() }).strict(),
  z
    .object({
      ...Base,
      ok: z.literal(false),
      error: z.string().min(1).max(2000),
      status: z.number().int().min(400).max(599),
    })
    .strict(),
]);

export async function POST(request: Request) {
  if (
    !authoriseAnalyserCallback(
      request.headers.get('authorization'),
      process.env.ANALYSER_SHARED_SECRET,
    )
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const supabase = createServiceRoleSupabase();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  let input: z.infer<typeof Callback>;
  try {
    input = Callback.parse(
      JSON.parse(await readResponseTextWithLimit(new Response(request.body), 8 * 1024 * 1024)),
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false },
      { status: error instanceof ResponseBodyTooLargeError ? 413 : 400 },
    );
  }
  let outcome;
  try {
    outcome = input.ok
      ? { ok: true as const, analysis: parseAnalyserResult(input.analysis) }
      : { ok: false as const, error: input.error, status: input.status };
  } catch (error) {
    if (!(error instanceof AnalyserOutputValidationError)) throw error;
    outcome = { ok: false as const, error: error.message.slice(0, 2000), status: 422 };
  }
  const result = await finishQueuedMusicAnalysis({
    supabase,
    analysisId: input.analysis_id,
    leaseToken: input.lease_token,
    runtimeMs: input.runtime_ms,
    outcome,
  });
  if (!result.ok && result.pending && !result.retryScheduled) {
    // Make Modal redeliver results when persistence failed, rather than acknowledging lost output.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (result.userId && result.analysisId && (result.ok || (!result.pending && !result.cancelled))) {
    const userId = result.userId;
    const musicAnalysisId = result.analysisId;
    after(async () => {
      if (result.ok)
        await resumeCueGenerationForCompletedAnalysis({ supabase, userId, musicAnalysisId });
      else
        await markLinkedShowGenerationFailed({
          supabase,
          userId,
          musicAnalysisId,
          error: result.error,
        });
    });
  }
  return NextResponse.json({
    ok: true,
    applied: result.ok || (!result.pending && !result.cancelled),
  });
}
