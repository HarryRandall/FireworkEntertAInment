import { after } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createAssortmentUpload,
  getPublicAssortmentByToken,
  prepareAssortmentSongAnalysis,
  resolveAssortmentSongSelection,
  verifyAssortmentAudioUpload,
} from '@/lib/assortments/public.server';
import { consumeAssortmentPublicRateLimit } from '@/lib/assortments/request-security.server';
import {
  markLinkedShowGenerationFailed,
  resumeCueGenerationForCompletedAnalysis,
} from '@/lib/music-analysis-lifecycle.server';
import { runMusicAnalysisForUpload } from '@/lib/show-analysis-runner.server';

// A cold Modal analyser can spend more than a minute restoring its snapshot.
// `after` shares this route's execution limit, so leave enough time to persist
// the completed analysis instead of abandoning it while its lease is running.
export const maxDuration = 300;

const PrepareUploadSchema = z.object({
  operation: z.literal('prepare-upload'),
  originalFilename: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024),
});

const AnalyseSchema = z.object({
  operation: z.literal('analyse'),
  selectionToken: z.string().regex(/^[a-f0-9]{64}$/),
});

const BodySchema = z.discriminatedUnion('operation', [PrepareUploadSchema, AnalyseSchema]);
const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' } as const;

function response(body: unknown, status = 200, retryAfterSeconds?: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      ...(retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : {}),
    },
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const assortment = await getPublicAssortmentByToken(token);
  if (!assortment) return response({ ok: false, error: 'Assortment unavailable.' }, 404);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return response({ ok: false, error: 'Invalid request.' }, 400);
  }
  const parsed = BodySchema.safeParse(input);
  if (!parsed.success) return response({ ok: false, error: 'Invalid song details.' }, 400);

  const operation = parsed.data.operation === 'prepare-upload' ? 'upload' : 'analyse';
  const limit = await consumeAssortmentPublicRateLimit({
    request,
    assortmentId: assortment.id,
    operation,
  });
  if (!limit.productionReady) {
    return response({ ok: false, error: 'Song selection is temporarily unavailable.' }, 503);
  }
  if (!limit.allowed) {
    return response(
      { ok: false, error: 'Too many song requests. Try again shortly.' },
      429,
      limit.retryAfterSeconds,
    );
  }

  try {
    if (parsed.data.operation === 'prepare-upload') {
      const upload = await createAssortmentUpload({
        assortment,
        originalFilename: parsed.data.originalFilename,
        contentType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes,
      });
      return response({ ok: true, ...upload });
    }

    const selection = await resolveAssortmentSongSelection({
      assortmentId: assortment.id,
      selectionToken: parsed.data.selectionToken,
    });
    if (!selection || selection.musicAnalysisId) {
      return response({ ok: false, error: 'Song selection unavailable.' }, 404);
    }
    if (!(await verifyAssortmentAudioUpload(selection))) {
      return response({ ok: false, error: 'The uploaded song could not be verified.' }, 400);
    }

    const prepared = await prepareAssortmentSongAnalysis({
      assortmentToken: token,
      selectionId: selection.id,
    });
    after(async () => {
      const result = await runMusicAnalysisForUpload({
        supabase: prepared.supabase,
        userId: prepared.fundingUserId,
        analysisId: prepared.analysisId,
        personality: 'balanced',
      });
      if (result.ok) {
        await resumeCueGenerationForCompletedAnalysis({
          supabase: prepared.supabase,
          userId: prepared.fundingUserId,
          musicAnalysisId: prepared.analysisId,
        });
      } else if (!result.pending && !result.cancelled) {
        await markLinkedShowGenerationFailed({
          supabase: prepared.supabase,
          userId: prepared.fundingUserId,
          musicAnalysisId: prepared.analysisId,
          error: result.error,
        });
      }
    });

    return response({ ok: true, selectionToken: parsed.data.selectionToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The song could not be prepared.';
    const status = message.includes('generation limit') ? 402 : 500;
    return response({ ok: false, error: message }, status);
  }
}
