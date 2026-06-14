/**
 * Top-level cue-generation runner.
 *
 * Pipeline stages (each one writes a `generation_status` row on failure):
 *   1. Load brief, analyser JSON, catalogue, build the cue slot grid.
 *   2. Use the fast local planner by default, or optionally call OpenRouter.
 *   3. Parse + validate the optional LLM response.
 *   4. Apply per-tube overlap dedupe for the optional LLM response.
 *   5. Replace the show's existing `show_timeline_items` with the accepted set.
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
import type { GenerationMode } from '@/lib/prompt-configs';
import { getActivePromptConfig, getShowCueGenerationSettings } from '@/lib/prompt-configs.server';
import { listFireworkProducts, syncShowDerivedFieldsForUser } from '@/lib/shows.server';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { extractProviderError, stripJsonFence } from './llm';
import {
  loadAnalysisState,
  loadBrief,
  markGenerationStatus,
  type AnalysisJsonLoadResult,
} from './loaders.server';
import {
  buildAnalysisSummary,
  buildSystemPrompt,
  projectCatalogue,
  projectSlotsForLLM,
} from './prompt';
import { planCuesFast } from './fast-planner';
import { planCuesOnBeats } from './beat-sync-planner';
import { launchPositionsForWidth, parseFireworkTypes, productMatchesTypes } from './show-options';
import { SHOW_STYLES, isShowStyleKey, type ShowStyleKey } from './show-styles';
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

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

function jsonByteLength(value: unknown): number {
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  return new TextEncoder().encode(text).length;
}

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
  const model = DEFAULT_CUE_MODEL;
  const generationSettings = await getShowCueGenerationSettings();
  // The show's style (picked in the wizard) overrides the global setting:
  // 'beat_test' runs the deterministic beat planner, every other style runs
  // the LLM with the fast planner as an automatic rescue path.
  let generationMode: GenerationMode | 'beat' = generationSettings.generationMode;
  let showStyle: ShowStyleKey | null = null;
  /** Launch positions the site supports (capped by `shows.site_width_feet`). */
  let maxTubes: 1 | 2 | 3 = 3;
  const totalStart = performance.now();
  const timings = {
    loadInputsMs: 0,
    slotBuildMs: 0,
    fastPlanMs: 0,
    promptBuildMs: 0,
    openRouterMs: 0,
    parseValidateMs: 0,
    dbWriteMs: 0,
  };
  let promptBytes = 0;
  let rawResponseBytes = 0;
  let slotCount = 0;
  let catalogueCount = 0;
  let acceptedCount = 0;
  let droppedCount = 0;
  const logTimings = (
    outcome: 'completed' | 'failed' | 'waiting',
    extra: { error?: string } = {},
  ) => {
    console.info('[cue-generation] timings', {
      outcome,
      showId,
      generationMode,
      model,
      slotCount,
      catalogueCount,
      acceptedCount,
      droppedCount,
      promptBytes,
      rawResponseBytes,
      loadInputsMs: timings.loadInputsMs,
      slotBuildMs: timings.slotBuildMs,
      fastPlanMs: timings.fastPlanMs,
      promptBuildMs: timings.promptBuildMs,
      openRouterMs: timings.openRouterMs,
      llmMs: timings.openRouterMs,
      parseValidateMs: timings.parseValidateMs,
      dbWriteMs: timings.dbWriteMs,
      totalMs: elapsedMs(totalStart),
      ...extra,
    });
  };

  await markGenerationStatus(supabase, userId, showId, {
    generation_status: 'running',
    generation_error: null,
    generated_cue_count: null,
    generation_started_at: new Date().toISOString(),
    generation_completed_at: null,
  });

  // === Stage 1: load + validate inputs ====================================
  let brief: ShowBriefRow | null;
  let analysis: AnalyserResult | null = null;
  let analysisResult: AnalysisJsonLoadResult = { status: 'absent', analysis: null };
  let products: Awaited<ReturnType<typeof listFireworkProducts>> = [];
  let catalogue: ReturnType<typeof projectCatalogue> = [];
  let slots: CueSlot[];

  const loadStart = performance.now();
  try {
    [brief, analysisResult] = await Promise.all([
      loadBrief(supabase, userId, showId),
      musicAnalysisId
        ? loadAnalysisState(supabase, musicAnalysisId)
        : Promise.resolve({ status: 'absent', analysis: null } satisfies AnalysisJsonLoadResult),
    ]);
    if (!brief) throw new Error('Show not found.');
    showStyle = isShowStyleKey(brief.show_style) ? brief.show_style : null;
    if (showStyle) {
      generationMode = SHOW_STYLES[showStyle].engine === 'beat' ? 'beat' : 'llm';
    }
    maxTubes = launchPositionsForWidth(brief.site_width_feet);
    if (musicAnalysisId) {
      if (analysisResult.status === 'completed') {
        analysis = analysisResult.analysis;
      } else if (analysisResult.status === 'failed') {
        const detail = analysisResult.errorMessage ? `: ${analysisResult.errorMessage}` : '.';
        throw new Error(`Music analysis failed${detail}`);
      } else if (analysisResult.status === 'running') {
        timings.loadInputsMs = elapsedMs(loadStart);
        logTimings('waiting');
        return { ok: true, pending: true, reason: 'music_analysis_running' };
      } else if (analysisResult.status === 'missing') {
        throw new Error('Music analysis was not found. Please upload the song again.');
      } else {
        throw new Error(
          'Music analysis completed without usable output. Please upload the song again.',
        );
      }
    } else {
      analysis = null;
    }

    products = await listFireworkProducts();
    if (products.length === 0) {
      throw new Error('Product catalogue contains no firework products.');
    }
    // Honour the user's firework-type constraint when it leaves a workable
    // catalogue; otherwise keep the full list and let the prompt express the
    // preference instead.
    const allowedTypes = parseFireworkTypes(brief.firework_types);
    if (allowedTypes) {
      const filtered = products.filter((product) => productMatchesTypes(product, allowedTypes));
      if (filtered.length >= 3) products = filtered;
    }
    catalogueCount = products.length;
    timings.loadInputsMs = elapsedMs(loadStart);

    const songDuration = analysis?.duration_seconds ?? brief.duration_seconds ?? 0;
    if (!songDuration || songDuration <= 0) {
      throw new Error("Song duration is unknown, can't time the show.");
    }

    const slotStart = performance.now();
    slots = buildCueSlots(analysis, songDuration, maxTubes);
    slotCount = slots.length;
    timings.slotBuildMs = elapsedMs(slotStart);
    if (slots.length === 0) {
      throw new Error('Could not derive any cue slots from the analysis.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!timings.loadInputsMs) timings.loadInputsMs = elapsedMs(loadStart);
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    logTimings('failed', { error: message });
    return { ok: false, error: message };
  }

  const songDuration = analysis?.duration_seconds ?? brief.duration_seconds ?? 0;
  let accepted: ReconstructedCue[] = [];

  /** Rescue path: deterministic local plan when the LLM cannot deliver. */
  const runFastFallback = () => {
    const planStart = performance.now();
    const plan = planCuesFast({
      brief: brief!,
      analysis,
      slots,
      products,
      songDuration,
    });
    accepted = plan.cues;
    acceptedCount = accepted.length;
    droppedCount = plan.skippedSlots;
    timings.fastPlanMs = elapsedMs(planStart);
  };

  if (generationMode === 'beat') {
    // === Stage 2: deterministic beat-sync test planning ===================
    // One single-shot cue on every analysed beat, rotating tubes - sync is
    // provably perfect, no LLM involved.
    const planStart = performance.now();
    const plan = planCuesOnBeats({ analysis, products, songDuration, maxTubes });
    accepted = plan.cues;
    acceptedCount = accepted.length;
    droppedCount = plan.skippedSlots;
    timings.fastPlanMs = elapsedMs(planStart);
  } else if (generationMode === 'fast') {
    // === Stage 2: fast local music-aware planning =========================
    runFastFallback();
  } else {
    // === Stage 2: build prompt + call the LLM ============================
    const promptStart = performance.now();
    catalogue = projectCatalogue(products, generationSettings.productCatalogueFields);
    const productIndex = new Map(products.map((product) => [product.id, product]));
    const slotIndex = new Map(slots.map((s) => [s.index, s]));

    const userPayload = {
      userPrompt:
        (brief.description ?? '').trim() ||
        '(The user did not supply a prompt, design a tasteful default show that follows the song structure.)',
      brief: {
        title: brief.title,
        moodTags: brief.mood_tags ?? [],
        timeOfDay: brief.time_of_day,
        location: brief.location,
        requestedDurationSeconds: brief.duration_seconds,
        budgetUsd: brief.budget_cents != null ? Math.round(brief.budget_cents / 100) : null,
        showStyle: showStyle ? SHOW_STYLES[showStyle].name : null,
        siteWidthFeet: brief.site_width_feet,
        launchPositions: maxTubes,
        fireworkTypes: parseFireworkTypes(brief.firework_types),
      },
      analysisSummary: buildAnalysisSummary(analysis, songDuration),
      catalogue,
      slots: projectSlotsForLLM(slots),
      targets: {
        slotCount: slots.length,
        minFillRatio: 0.55,
        maxFillRatio: 0.8,
        chorusFillRatio: 0.85,
        songDurationSeconds: songDuration,
      },
    };

    const promptConfig = await getActivePromptConfig('show_cue_generation');
    const systemPrompt = buildSystemPrompt({
      systemPromptText: promptConfig?.systemPromptText,
      productContextText: promptConfig?.productContextText,
      productCatalogueFields: generationSettings.productCatalogueFields,
      showStyle,
    });
    const userContent = JSON.stringify(userPayload);
    promptBytes = jsonByteLength(systemPrompt) + jsonByteLength(userContent);
    timings.promptBuildMs = elapsedMs(promptStart);
    let rawResponse: string | null = null;
    const llmStart = performance.now();
    try {
      const client = getOpenRouterClient();
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.45,
        max_tokens: 5000,
        // `json_object` is the widely-supported structured-output mode on
        // OpenRouter. `json_schema` is OpenAI-only.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      });
      rawResponse = completion.choices[0]?.message?.content ?? '';
      if (!rawResponse) throw new Error('LLM returned an empty response.');
      rawResponseBytes = jsonByteLength(rawResponse);
      timings.openRouterMs = elapsedMs(llmStart);
    } catch (error) {
      if (!timings.openRouterMs) timings.openRouterMs = elapsedMs(llmStart);
      const providerDetail = extractProviderError(error);
      const baseMessage = error instanceof Error ? error.message : String(error);
      const message = providerDetail
        ? `${baseMessage} - ${providerDetail} (model: ${model})`
        : `${baseMessage} (model: ${model})`;
      // The user must still get a show: rescue with the local fast planner
      // instead of failing the whole run.
      console.error('[cue-generation] LLM call failed, falling back to fast planner:', {
        model,
        error: message,
      });
      rawResponse = null;
    }

    // === Stage 3: parse + validate the LLM response ======================
    let parsed: ReturnType<typeof GenerationResponseSchema.parse> | null = null;
    const parseStart = performance.now();
    if (rawResponse) {
      try {
        parsed = GenerationResponseSchema.parse(JSON.parse(stripJsonFence(rawResponse)));
      } catch (error) {
        const message =
          error instanceof Error
            ? `Could not parse LLM response: ${error.message}`
            : 'Could not parse LLM response.';
        console.error('[cue-generation] parse failed, falling back to fast planner:', message);
        parsed = null;
      }
    }

    if (!parsed) {
      timings.parseValidateMs = elapsedMs(parseStart);
      runFastFallback();
    } else {
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
        if (!productIndex.has(a.productId)) {
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

      // === Stage 4: tube-overlap dedupe with real product durations ========
      reconstructed.sort((a, b) => a.timeSeconds - b.timeSeconds);
      const acceptedWindows: CueWindow[] = [];
      for (const cue of reconstructed) {
        const product = productIndex.get(cue.productId);
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
      acceptedCount = accepted.length;
      droppedCount = dropped.length;
      timings.parseValidateMs = elapsedMs(parseStart);

      // An LLM response that validated down to nothing is still a failure
      // mode the user shouldn't see - rescue with the fast planner.
      if (accepted.length === 0) {
        console.error(
          '[cue-generation] LLM returned no usable cues after validation, falling back to fast planner.',
        );
        runFastFallback();
      }
    }
  }

  if (accepted.length === 0) {
    const message =
      generationMode === 'beat'
        ? 'Beat-sync planner returned no usable cues.'
        : generationMode === 'fast'
          ? 'Fast cue planner returned no usable cues.'
          : 'Cue generation returned no usable cues, even after the fast-planner fallback.';
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    logTimings('failed', { error: message });
    return { ok: false, error: message };
  }

  // === Stage 5: replace existing show_timeline_items with the new set =====
  const dbStart = performance.now();
  const { error: deleteError } = await supabase
    .from('show_timeline_items')
    .delete()
    .eq('show_id', showId);
  if (deleteError) {
    const message = `Could not clear existing cues: ${deleteError.message}`;
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    timings.dbWriteMs = elapsedMs(dbStart);
    logTimings('failed', { error: message });
    return { ok: false, error: message };
  }

  const rows = accepted.map((cue, i) => ({
    show_id: showId,
    position: i + 1,
    time_seconds: cue.timeSeconds,
    description: cue.description,
    catalogue_item_id: cue.productId,
    launch_position_index: cue.tube,
  }));

  const { error: insertError } = await supabase.from('show_timeline_items').insert(rows);
  if (insertError) {
    const message = `Could not insert generated cues: ${insertError.message}`;
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    timings.dbWriteMs = elapsedMs(dbStart);
    logTimings('failed', { error: message });
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
  timings.dbWriteMs = elapsedMs(dbStart);
  logTimings('completed');

  return { ok: true, cueCount: accepted.length };
}
