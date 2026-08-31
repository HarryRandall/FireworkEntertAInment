import { after } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createAssortmentShowRecord,
  createCapabilityToken,
  getPublicAssortmentByToken,
  hashCapabilityToken,
  resolveAssortmentSongSelection,
  resolvePublicAssortmentShow,
} from '@/lib/assortments/public.server';
import { consumeAssortmentPublicRateLimit } from '@/lib/assortments/request-security.server';
import { creditActionForGenerationMode } from '@/lib/ai-credits.server';
import { generateCuesForShow } from '@/lib/cue-generation.server';
import { randomCover } from '@/lib/cover';
import type { Json } from '@/lib/database.types';
import { DEFAULT_CUE_MODEL } from '@/lib/openrouter.server';
import { getShowCueGenerationSettings } from '@/lib/prompt-configs.server';

const BodySchema = z.union([
  z.object({ selectionToken: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ regenerateFrom: z.string().regex(/^[a-f0-9]{64}$/) }),
]);
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
  if (!parsed.success) return response({ ok: false, error: 'Invalid generation request.' }, 400);

  const limit = await consumeAssortmentPublicRateLimit({
    request,
    assortmentId: assortment.id,
    operation: 'generate',
  });
  if (!limit.productionReady) {
    return response({ ok: false, error: 'Show generation is temporarily unavailable.' }, 503);
  }
  if (!limit.allowed) {
    return response(
      { ok: false, error: 'Too many show requests. Try again shortly.' },
      429,
      limit.retryAfterSeconds,
    );
  }

  try {
    let selectionId: string;
    let sourceShowId: string | null = null;
    if ('selectionToken' in parsed.data) {
      const selection = await resolveAssortmentSongSelection({
        assortmentId: assortment.id,
        selectionToken: parsed.data.selectionToken,
      });
      if (!selection?.musicAnalysisId) {
        return response({ ok: false, error: 'Song selection unavailable.' }, 404);
      }
      selectionId = selection.id;
    } else {
      const priorShow = await resolvePublicAssortmentShow({
        assortmentId: assortment.id,
        showAccessToken: parsed.data.regenerateFrom,
      });
      if (!priorShow) return response({ ok: false, error: 'Show unavailable.' }, 404);
      selectionId = priorShow.selectionId;
      sourceShowId = priorShow.id;
    }

    const settings = await getShowCueGenerationSettings();
    const generationMode = settings.generationMode;
    const selectedCueModel = generationMode === 'llm' ? DEFAULT_CUE_MODEL : null;
    const accessToken = createCapabilityToken();
    const created = await createAssortmentShowRecord({
      assortmentToken: token,
      selectionId,
      accessTokenHash: hashCapabilityToken(accessToken),
      title: `${assortment.name} show`,
      generationMode,
      selectedCueModel,
      creditActionKey: creditActionForGenerationMode(generationMode, selectedCueModel ?? undefined),
      coverShader: randomCover() as unknown as Json,
      sourceShowId,
    });

    after(async () => {
      const result = await generateCuesForShow({
        supabase: created.supabase,
        userId: created.fundingUserId,
        showId: created.showId,
        musicAnalysisId: created.musicAnalysisId,
        selectedCueModel,
        generationMode,
      });
      if (!result.ok) {
        console.error('[assortment-qr] background cue generation failed:', result.error);
      }
    });

    return response({
      ok: true,
      path: `/a/${token}/show/${accessToken}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The show could not be created.';
    const status = message.includes('generation limit') ? 402 : 500;
    return response({ ok: false, error: message }, status);
  }
}
