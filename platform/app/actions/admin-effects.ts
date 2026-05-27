'use server';

/**
 * Admin effect-spec actions. These mutate `effect_specs` only, never product
 * shot metadata, so product calibre and sequencing remain product-owned.
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  requirePermission,
} from '@/lib/admin.server';
import type { Json } from '@/lib/database.types';
import { extractProviderError, stripJsonFence } from '@/lib/cue-generation/llm';
import { getOpenRouterClient } from '@/lib/openrouter.server';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

const DEFAULT_EFFECT_MODEL = process.env.OPENROUTER_EFFECT_MODEL ?? 'openai/gpt-4.1-mini';

type Result = { ok: true; updatedAt: string } | { ok: false; error: string };
type DraftResult =
  | {
      ok: true;
      draft: {
        name: string;
        description: string | null;
        type: string;
        durationSeconds: number;
        heightMeters: number | null;
        shotCount: number;
        specJson: Json;
      };
      model: string;
    }
  | { ok: false; error: string };

const EffectPatchSchema = z.object({
  id: z.string().uuid(),
  expectedUpdatedAt: z.string().trim().min(1),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  type: z.string().trim().min(1).max(80),
  durationSeconds: z.coerce.number().min(0.1).max(3600),
  heightMeters: z.coerce.number().min(0).max(1000).optional().nullable(),
  shotCount: z.coerce.number().int().min(1).max(1000),
  specJson: z.string().trim().min(2).max(100_000),
});

const RefinementSchema = EffectPatchSchema.omit({ expectedUpdatedAt: true }).extend({
  prompt: z.string().trim().min(3).max(2000),
});

const RefinedDraftSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).nullable().default(null),
  type: z.string().trim().min(1).max(80),
  durationSeconds: z.coerce.number().min(0.1).max(3600),
  heightMeters: z.coerce.number().min(0).max(1000).nullable().default(null),
  shotCount: z.coerce.number().int().min(1).max(1000),
  specJson: z.unknown(),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function parseSpecJson(text: string): { ok: true; value: Json } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Effect JSON is invalid.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Effect JSON must be an object.' };
  }

  return { ok: true, value: parsed as Json };
}

function asJsonObject(value: unknown): Json | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Json;
}

/** Persist one valid effect-spec draft with optimistic conflict detection. */
export async function updateEffect(input: z.infer<typeof EffectPatchSchema>): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = EffectPatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const spec = parseSpecJson(parsed.data.specJson);
  if (!spec.ok) return { ok: false, error: spec.error };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('effect_specs')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      type: parsed.data.type,
      duration_seconds: parsed.data.durationSeconds,
      height_meters: parsed.data.heightMeters ?? null,
      shot_count: parsed.data.shotCount,
      spec_json: spec.value,
    })
    .eq('id', parsed.data.id)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select('updated_at')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This effect changed in another session. Refresh before saving again.',
    };
  }

  await invalidateAdminEffectsCache(parsed.data.id);
  await invalidateAdminFireworksCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/effects');
  revalidatePath(`/admin/effects/${parsed.data.id}`);
  revalidatePath('/admin/fireworks');
  return { ok: true, updatedAt: data.updated_at };
}

/** Ask OpenRouter for a reviewable draft edit. This does not write to Supabase. */
export async function refineEffectDraft(
  input: z.infer<typeof RefinementSchema>,
): Promise<DraftResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = RefinementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const spec = parseSpecJson(parsed.data.specJson);
  if (!spec.ok) return { ok: false, error: spec.error };

  const model = DEFAULT_EFFECT_MODEL;
  let rawResponse: string;
  try {
    const client = getOpenRouterClient();
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.25,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You edit ShowCrafter firework effect JSON. Return one JSON object only with keys name, description, type, durationSeconds, heightMeters, shotCount, specJson. Preserve existing JSON fields unless the requested visual change requires editing them. Do not add markdown.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            prompt: parsed.data.prompt,
            current: {
              name: parsed.data.name,
              description: parsed.data.description ?? null,
              type: parsed.data.type,
              durationSeconds: parsed.data.durationSeconds,
              heightMeters: parsed.data.heightMeters ?? null,
              shotCount: parsed.data.shotCount,
              specJson: spec.value,
            },
          }),
        },
      ],
    });
    rawResponse = completion.choices[0]?.message?.content ?? '';
    if (!rawResponse) return { ok: false, error: 'AI returned an empty response.' };
  } catch (error) {
    const providerDetail = extractProviderError(error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: providerDetail ? `${message}: ${providerDetail}` : message,
    };
  }

  let draftJson: unknown;
  try {
    draftJson = JSON.parse(stripJsonFence(rawResponse));
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Could not parse AI draft: ${error.message}`
          : 'Could not parse AI draft.',
    };
  }

  const draft = RefinedDraftSchema.safeParse(draftJson);
  if (!draft.success) return { ok: false, error: firstError(draft.error) };

  const specJson = asJsonObject(draft.data.specJson);
  if (!specJson) return { ok: false, error: 'AI draft returned non-object effect JSON.' };

  return {
    ok: true,
    model,
    draft: {
      ...draft.data,
      specJson,
    },
  };
}
