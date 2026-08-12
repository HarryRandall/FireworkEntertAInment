/** POST handler that proxies an uploaded audio file to the Python `analyser` and persists the resulting features. */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runShowAnalysisForShow } from '@/lib/show-analysis-runner.server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const AnalyseRequestSchema = z.object({
  showId: z.string().uuid(),
  personality: z
    .enum(['balanced', 'bold', 'cinematic', 'elegant', 'intimate', 'playful'])
    .default('balanced'),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const parsed = AnalyseRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError('Invalid analyse request.', 400);
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonError('You must be signed in to analyse a show.', 401);
  }

  const result = await runShowAnalysisForShow({
    supabase,
    userId: user.id,
    showId: parsed.data.showId,
    personality: parsed.data.personality,
  });

  if (!result.ok) {
    if (result.pending) {
      return NextResponse.json(
        { analysisId: result.analysisId, status: 'running' },
        { status: 202 },
      );
    }
    return jsonError(result.error, result.analysisId ? 422 : 400);
  }

  return NextResponse.json({
    analysisId: result.analysisId,
    contextMarkdown: result.contextMarkdown,
  });
}
