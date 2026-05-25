/**
 * Top-level cue-generation runner.
 *
 * Pipeline stages (each one writes a `generation_status` row on failure):
 *   1. Load brief, analyser JSON, catalogue, build the cue slot grid.
 *   2. Project the prompt payload and call OpenRouter.
 *   3. Parse + validate the response, drop bad slots / dupes / unknown ids.
 *   4. Apply per-tube overlap dedupe with real product durations.
 *   5. Replace the show's existing `show_cues` with the accepted set.
 *   6. Mark the show `completed` and refresh derived fields.
 */
import 'server-only';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { buildCueSlots, type CueSlot } from '@/lib/beat-grid.server';
import {
  MIN_PRODUCT_DURATION_SECONDS,
  findTubeOverlap,
  type CueWindow,
} from '@/lib/cue-overlap.server';
import { DEFAULT_CUE_MODEL, getOpenRouterClient } from '@/lib/openrouter.server';
import { listFireworkProducts, syncShowDerivedFieldsForUser } from '@/lib/shows.server';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { extractProviderError, stripJsonFence } from './llm';
import { loadAnalysisJson, loadBrief, markGenerationStatus } from './loaders.server';
import {
  buildAnalysisSummary,
  buildSystemPrompt,
  projectCatalogue,
  projectSlotsForLLM,
} from './prompt';
import {
  GenerationResponseSchema,
  type Assignment,
  type GenerateCuesResult,
  type ShowBriefRow,
} from './schemas';

type AppSupabase = SupabaseClient<Database>;

/** Generated cue with the slot context preserved for downstream validation. */
type ReconstructedCue = {
  timeSeconds: number;
  tube: 0 | 1 | 2;
  productId: string;
  description: string;
  slotIndex: number;
  intensity: number;
};

/**
 * Generate cues for a show end-to-end. Returns `{ ok: true }` on success and
 * `{ ok: false, error }` on any failure mode; failure also writes the error
 * to `shows.generation_error` so the UI can surface it.
 */
export async function generateCuesForShow(params: {
  supabase: AppSupabase;
  userId: string;
  showId: string;
  musicAnalysisId: string | null;
}): Promise<GenerateCuesResult> {
  const { supabase, userId, showId, musicAnalysisId } = params;

  await markGenerationStatus(supabase, userId, showId, {
    generation_status: 'running',
    generation_error: null,
    generated_cue_count: null,
    generation_started_at: new Date().toISOString(),
    generation_completed_at: null,
  });

  // === Stage 1: load + validate inputs ====================================
  let brief: ShowBriefRow | null;
  let analysis: AnalyserResult | null;
  let catalogue: ReturnType<typeof projectCatalogue>;
  let slots: CueSlot[];

  try {
    [brief, analysis] = await Promise.all([
      loadBrief(supabase, userId, showId),
      musicAnalysisId ? loadAnalysisJson(supabase, musicAnalysisId) : Promise.resolve(null),
    ]);
    if (!brief) throw new Error('Show not found.');

    const products = await listFireworkProducts();
    catalogue = projectCatalogue(products);
    if (catalogue.length === 0) {
      throw new Error('Product catalogue contains no single-shot fireworks.');
    }

    const songDuration = analysis?.duration_seconds ?? brief.duration_seconds ?? 0;
    if (!songDuration || songDuration <= 0) {
      throw new Error("Song duration is unknown — can't time the show.");
    }

    slots = buildCueSlots(analysis, songDuration);
    if (slots.length === 0) {
      throw new Error('Could not derive any cue slots from the analysis.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }

  // === Stage 2: build prompt + call the LLM ==============================
  const catalogueIndex = new Map(catalogue.map((p) => [p.id, p]));
  const slotIndex = new Map(slots.map((s) => [s.index, s]));
  const songDuration = analysis?.duration_seconds ?? brief.duration_seconds ?? 0;

  const userPayload = {
    userPrompt:
      (brief.description ?? '').trim() ||
      '(The user did not supply a prompt — design a tasteful default show that follows the song structure.)',
    brief: {
      title: brief.title,
      moodTags: brief.mood_tags ?? [],
      timeOfDay: brief.time_of_day,
      location: brief.location,
      requestedDurationSeconds: brief.duration_seconds,
      budgetUsd: brief.budget_cents != null ? Math.round(brief.budget_cents / 100) : null,
    },
    analysisSummary: buildAnalysisSummary(analysis, songDuration),
    catalogue,
    slots: projectSlotsForLLM(slots),
    targets: {
      slotCount: slots.length,
      minFillRatio: 0.7,
      maxFillRatio: 0.9,
      songDurationSeconds: songDuration,
    },
  };

  const systemPrompt = buildSystemPrompt();
  const model = DEFAULT_CUE_MODEL;
  let rawResponse: string;
  try {
    const client = getOpenRouterClient();
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      // `json_object` is the widely-supported structured-output mode on
      // OpenRouter (Anthropic + most providers). `json_schema` is OpenAI-only.
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    });
    rawResponse = completion.choices[0]?.message?.content ?? '';
    if (!rawResponse) throw new Error('LLM returned an empty response.');
  } catch (error) {
    const providerDetail = extractProviderError(error);
    const baseMessage = error instanceof Error ? error.message : String(error);
    const message = providerDetail
      ? `${baseMessage} — ${providerDetail} (model: ${model})`
      : `${baseMessage} (model: ${model})`;
    console.error('[cue-generation] LLM call failed:', { model, error });
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }

  // === Stage 3: parse + validate the LLM response ========================
  let parsed: ReturnType<typeof GenerationResponseSchema.parse>;
  try {
    parsed = GenerationResponseSchema.parse(JSON.parse(stripJsonFence(rawResponse)));
  } catch (error) {
    const message =
      error instanceof Error
        ? `Could not parse LLM response: ${error.message}`
        : 'Could not parse LLM response.';
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }

  // Drop unknown slots / unknown products / duplicate slot indices.
  const seenSlot = new Set<number>();
  const reconstructed: ReconstructedCue[] = [];
  const dropped: Array<{ assignment: Assignment; reason: string }> = [];

  for (const a of parsed.cues) {
    const slot = slotIndex.get(a.slotIndex);
    if (!slot) {
      dropped.push({ assignment: a, reason: 'unknown slotIndex' });
      continue;
    }
    if (seenSlot.has(a.slotIndex)) {
      dropped.push({ assignment: a, reason: 'duplicate slotIndex' });
      continue;
    }
    if (!catalogueIndex.has(a.productId)) {
      dropped.push({ assignment: a, reason: 'unknown productId' });
      continue;
    }
    seenSlot.add(a.slotIndex);
    reconstructed.push({
      timeSeconds: slot.time,
      tube: slot.tube,
      productId: a.productId,
      description: a.description,
      slotIndex: slot.index,
      intensity: slot.intensity,
    });
  }

  // === Stage 4: tube-overlap dedupe with real product durations ==========
  reconstructed.sort((a, b) => a.timeSeconds - b.timeSeconds);
  const accepted: ReconstructedCue[] = [];
  const acceptedWindows: CueWindow[] = [];
  for (const cue of reconstructed) {
    const product = catalogueIndex.get(cue.productId);
    const productDuration = product?.durationSeconds ?? MIN_PRODUCT_DURATION_SECONDS;
    const window: CueWindow = {
      timeSeconds: cue.timeSeconds,
      durationSeconds: productDuration,
      launchPositionIndex: cue.tube,
    };
    const conflict = findTubeOverlap(window, acceptedWindows);
    if (conflict) {
      dropped.push({
        assignment: {
          slotIndex: cue.slotIndex,
          productId: cue.productId,
          description: cue.description,
        },
        reason: 'tube overlap',
      });
      continue;
    }
    accepted.push(cue);
    acceptedWindows.push(window);
  }

  if (accepted.length === 0) {
    const message = 'LLM returned no usable cues after validation.';
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }

  // === Stage 5: replace existing show_cues with the new set ==============
  const { error: deleteError } = await supabase.from('show_cues').delete().eq('show_id', showId);
  if (deleteError) {
    const message = `Could not clear existing cues: ${deleteError.message}`;
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }

  const rows = accepted.map((cue, i) => ({
    show_id: showId,
    position: i + 1,
    time_seconds: cue.timeSeconds,
    description: cue.description,
    product_id: cue.productId,
    launch_position_index: cue.tube,
  }));

  const { error: insertError } = await supabase.from('show_cues').insert(rows);
  if (insertError) {
    const message = `Could not insert generated cues: ${insertError.message}`;
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }

  // === Stage 6: mark complete + refresh derived fields ===================
  await markGenerationStatus(supabase, userId, showId, {
    generation_status: 'completed',
    generation_error: null,
    generated_cue_count: accepted.length,
    generation_completed_at: new Date().toISOString(),
  });

  await syncShowDerivedFieldsForUser(userId, {
    showId,
    showSlug: brief.slug,
  });
  revalidatePath(`/shows/${brief.slug}`);
  revalidatePath(`/shows/${brief.slug}/preview`);

  return { ok: true, cueCount: accepted.length };
}
