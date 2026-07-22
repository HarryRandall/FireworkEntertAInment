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
import type { Database, Json } from '@/lib/database.types';
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
import { fireworkOccupancyDurationSeconds } from '@/lib/show-domain';
import {
  refundAiCreditReservation,
  settleAiCreditReservation,
  showGenerationReservationKey,
} from '@/lib/ai-credits.server';
import { normalisePersistedCueModel } from '@/lib/cue-models';
import { extractProviderError, stripJsonFence } from './llm';
import { parseCreativeDirection } from './creative-direction';
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
import { scheduleProductForCueSlot } from './impact-timing';
import {
  launchPositionsForWidth,
  occupiedLaunchPositions,
  parseFireworkTypes,
  productFitsLaunchPositions,
  productMatchesTypes,
} from './show-options';
import { SHOW_STYLES, asShowStyleKey, isShowStyleKey, type ShowStyleKey } from './show-styles';
import {
  GenerationResponseSchema,
  type Assignment,
  type CueEmphasis,
  type GenerateCuesResult,
  type ShowBriefRow,
} from './schemas';

type AppSupabase = SupabaseClient<Database>;

/** Two-decimal rounding that mirrors the `numeric(8,2)` timeline column. */
function toStoredTimeSeconds(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Final guarantee that the persisted set satisfies the database timeline-safety
 * trigger, applied to every planner path (beat, fast, and LLM).
 *
 * The planners avoid overlaps with their own duration model, but the database
 * stores `time_seconds` as `numeric(8,2)` and reserves each tube for the
 * catalogue item's *greatest* stored or child duration. Re-checking with
 * database-identical rounding and conservative durations means a straggler is
 * dropped here rather than failing the whole guarded RPC with
 * "Timeline item overlaps an occupied launch position".
 */
function enforceTimelineTubeSafety(
  cues: ReconstructedCue[],
  products: Awaited<ReturnType<typeof listFireworkProducts>>,
  maxTubes: 1 | 2 | 3,
): ReconstructedCue[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const ordered = [...cues].sort((a, b) => a.timeSeconds - b.timeSeconds || a.tube - b.tube);
  const kept: ReconstructedCue[] = [];
  const acceptedWindows: CueWindow[] = [];
  for (const cue of ordered) {
    const product = productById.get(cue.productId);
    if (!product) continue;
    const occupiedTubes = occupiedLaunchPositions(product, cue.tube, maxTubes);
    if (!occupiedTubes) continue;
    // Compare on the rounded value the trigger will actually see, and reserve
    // the tube for the same conservative duration the database enforces.
    const storedTime = toStoredTimeSeconds(cue.timeSeconds);
    const durationSeconds = Math.max(
      fireworkOccupancyDurationSeconds(product) ?? MIN_PRODUCT_DURATION_SECONDS,
      MIN_PRODUCT_DURATION_SECONDS,
    );
    const windows: CueWindow[] = occupiedTubes.map((launchPositionIndex) => ({
      timeSeconds: storedTime,
      durationSeconds,
      launchPositionIndex,
    }));
    if (windows.some((window) => findTubeOverlap(window, acceptedWindows))) continue;
    kept.push({ ...cue, timeSeconds: storedTime });
    acceptedWindows.push(...windows);
  }
  return kept;
}

/** Generated cue with the slot context preserved for downstream validation. */
type ReconstructedCue = {
  /** Renderer launch time. */
  timeSeconds: number;
  /** Musical anchor: direct burst time or multishot sequence start. */
  impactTimeSeconds: number;
  liftTimeSeconds: number;
  tube: 0 | 1 | 2;
  productId: string;
  description: string;
  slotIndex: number;
  intensity: number;
  emphasis: CueEmphasis;
};

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

function jsonByteLength(value: unknown): number {
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  return new TextEncoder().encode(text).length;
}

function estimateAchievableCueCount(params: {
  products: Awaited<ReturnType<typeof listFireworkProducts>>;
  songDuration: number;
  maxTubes: 1 | 2 | 3;
  slotCount: number;
}): number {
  const { products, songDuration, maxTubes, slotCount } = params;
  let cheapestTubeSeconds = Infinity;
  for (const product of products) {
    const duration = Math.max(
      fireworkOccupancyDurationSeconds(product) ?? MIN_PRODUCT_DURATION_SECONDS,
      0.5,
    );
    for (let tube = 0; tube < maxTubes; tube += 1) {
      const occupiedTubes = occupiedLaunchPositions(product, tube as 0 | 1 | 2, maxTubes);
      if (!occupiedTubes) continue;
      cheapestTubeSeconds = Math.min(cheapestTubeSeconds, duration * occupiedTubes.length);
    }
  }
  if (!Number.isFinite(cheapestTubeSeconds)) return 0;
  // Leave headroom for fixed beat placement and lift-adjusted early windows.
  const durationCapacity = Math.floor(((songDuration * maxTubes) / cheapestTubeSeconds) * 0.85);
  return Math.min(slotCount, Math.max(1, durationCapacity));
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
  selectedCueModel?: string | null;
  generationMode?: GenerationMode | 'beat';
}): Promise<GenerateCuesResult> {
  const { supabase, userId, showId, musicAnalysisId, selectedCueModel } = params;
  const creditReservationKey = showGenerationReservationKey(showId);
  let model = normalisePersistedCueModel(selectedCueModel, DEFAULT_CUE_MODEL);
  const generationSettings = await getShowCueGenerationSettings();
  // The global setting decides fast vs LLM for normal styles. The dedicated
  // Beat precision style remains a deterministic override.
  let generationMode: GenerationMode | 'beat' =
    params.generationMode ?? generationSettings.generationMode;
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
  const refundGenerationCredits = async (reason: string) => {
    const result = await refundAiCreditReservation(supabase, {
      userId,
      reservationKey: creditReservationKey,
      metadata: { reason },
    });
    if (!result.ok && result.error !== 'Credit reservation was not found.') {
      console.error('[cue-generation] credit refund failed:', result.error);
    }
  };
  const settleGenerationCredits = async () => {
    const result = await settleAiCreditReservation(supabase, {
      userId,
      reservationKey: creditReservationKey,
      metadata: {
        acceptedCount,
        generationMode,
        model,
        promptBytes,
        rawResponseBytes,
      },
    });
    if (!result.ok && result.error !== 'Credit reservation was not found.') {
      console.error('[cue-generation] credit settlement failed:', result.error);
    }
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
    model = normalisePersistedCueModel(
      brief.selected_cue_model ?? selectedCueModel,
      DEFAULT_CUE_MODEL,
    );
    showStyle = isShowStyleKey(brief.show_style) ? brief.show_style : null;
    if (showStyle && SHOW_STYLES[showStyle].engine === 'beat') {
      generationMode = 'beat';
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
    // A generated show must resolve to a purchasable shopping list. Items with
    // no available supplier price (e.g. style-default demo fireworks) would
    // produce a $0 show the user cannot actually buy, so they never enter the
    // planning pool.
    products = products.filter((product) => product.minPriceCents != null);
    if (products.length === 0) {
      throw new Error('No purchasable fireworks are available from supplier inventory.');
    }
    // Multishot child positions are absolute. Products that address a launch
    // position outside this site's width cannot be scheduled safely.
    products = products.filter((product) => productFitsLaunchPositions(product, maxTubes));
    if (products.length === 0) {
      throw new Error('No catalogue products fit the launch positions available at this site.');
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
    await refundGenerationCredits(message);
    logTimings('failed', { error: message });
    return { ok: false, error: message };
  }

  const songDuration = analysis?.duration_seconds ?? brief.duration_seconds ?? 0;
  const creativeDirection = parseCreativeDirection(
    [brief.title, brief.description, ...(brief.mood_tags ?? [])].filter(Boolean).join(' '),
    asShowStyleKey(brief.show_style),
  );
  const sparseGeneration = showStyle === 'minimalist' || creativeDirection.density === 'sparse';
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
    // === Stage 2: deterministic beat-precision planning ==================
    // Every accepted direct shell bursts on its analysed beat. Unsafe or
    // physically impossible hits are skipped instead of being shifted late.
    const planStart = performance.now();
    const plan = planCuesOnBeats({ analysis, products, songDuration, brief, maxTubes });
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
        minFillRatio: sparseGeneration ? 0.5 : 0.75,
        maxFillRatio: sparseGeneration ? 0.68 : 0.95,
        chorusFillRatio: sparseGeneration ? 0.72 : 1,
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
        temperature: 0.5,
        max_tokens: 6000,
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
        const product = productIndex.get(a.productId);
        if (!product) {
          dropped.push({ assignment: a, reason: 'unknown productId' });
          continue;
        }
        const emphasis = a.emphasis ?? slot.emphasis;
        const timing = scheduleProductForCueSlot({
          product,
          emphasis,
          targetTimeSeconds: slot.time,
        });
        if (!timing) {
          dropped.push({
            assignment: a,
            reason: 'impact requires a launch before the show starts',
          });
          continue;
        }
        seenSlot.add(a.slotIndex);
        reconstructed.push({
          timeSeconds: timing.launchTimeSeconds,
          impactTimeSeconds: timing.impactTimeSeconds,
          liftTimeSeconds: timing.liftTimeSeconds,
          tube: slot.tube,
          productId: a.productId,
          description: a.description ?? product.name,
          slotIndex: slot.index,
          intensity: slot.intensity,
          emphasis,
        });
      }

      // === Stage 4: tube-overlap dedupe with real product durations ========
      reconstructed.sort((a, b) => a.timeSeconds - b.timeSeconds);
      const acceptedWindows: CueWindow[] = [];
      for (const cue of reconstructed) {
        const product = productIndex.get(cue.productId);
        const productDuration = product
          ? (fireworkOccupancyDurationSeconds(product) ?? MIN_PRODUCT_DURATION_SECONDS)
          : MIN_PRODUCT_DURATION_SECONDS;
        const occupiedTubes = product ? occupiedLaunchPositions(product, cue.tube, maxTubes) : null;
        if (!occupiedTubes) {
          dropped.push({
            assignment: {
              slotIndex: cue.slotIndex,
              productId: cue.productId,
              description: cue.description,
            },
            reason: 'product uses a launch position outside the site',
          });
          continue;
        }
        const windows: CueWindow[] = occupiedTubes.map((launchPositionIndex) => ({
          timeSeconds: cue.timeSeconds,
          durationSeconds: productDuration,
          launchPositionIndex,
        }));
        const conflict = windows.some((window) => findTubeOverlap(window, acceptedWindows));
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
        acceptedWindows.push(...windows);
      }
      acceptedCount = accepted.length;
      droppedCount = dropped.length;
      timings.parseValidateMs = elapsedMs(parseStart);

      // A barely surviving response still looks broken. Require the requested
      // fill target and defining musical peaks, bounded by catalogue capacity.
      const targetFillRatio = sparseGeneration ? 0.5 : 0.75;
      const targetMinimumCount = Math.ceil(slots.length * targetFillRatio);
      const achievableCount = estimateAchievableCueCount({
        products,
        songDuration,
        maxTubes,
        slotCount: slots.length,
      });
      const minimumViableCount = Math.min(targetMinimumCount, achievableCount);
      const acceptedSlotIndices = new Set(accepted.map((cue) => cue.slotIndex));
      const missingProtectedSlots = slots.filter(
        (slot) =>
          (slot.nearClimax || slot.emphasis === 'peak') && !acceptedSlotIndices.has(slot.index),
      );
      if (accepted.length < minimumViableCount || missingProtectedSlots.length > 0) {
        console.error(
          '[cue-generation] LLM did not meet viable show requirements after validation, falling back to fast planner.',
          {
            acceptedCount: accepted.length,
            minimumViableCount,
            missingProtectedSlotCount: missingProtectedSlots.length,
          },
        );
        runFastFallback();
      }
    }
  }

  // Guarantee database-safe spacing for every path before the guarded write.
  accepted = enforceTimelineTubeSafety(accepted, products, maxTubes);
  acceptedCount = accepted.length;

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
    await refundGenerationCredits(message);
    logTimings('failed', { error: message });
    return { ok: false, error: message };
  }

  // === Stage 5: transactionally replace show_timeline_items ================
  const dbStart = performance.now();
  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const rows = accepted.map((cue, i) => ({
    position: i + 1,
    time_seconds: cue.timeSeconds,
    description: productNameById.get(cue.productId) ?? cue.description,
    catalogue_item_id: cue.productId,
    launch_position_index: cue.tube,
    emphasis: cue.emphasis,
  }));

  const { data: replacedCount, error: replaceError } = await supabase.rpc(
    'replace_show_timeline_items',
    {
      p_show_id: showId,
      p_user_id: userId,
      p_items: rows as Json,
    },
  );
  if (replaceError) {
    const message = `Could not replace generated cues: ${replaceError.message}`;
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    timings.dbWriteMs = elapsedMs(dbStart);
    await refundGenerationCredits(message);
    logTimings('failed', { error: message });
    return { ok: false, error: message };
  }
  if (replacedCount !== rows.length) {
    const message = `Cue replacement wrote ${replacedCount ?? 0} of ${rows.length} cues.`;
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    timings.dbWriteMs = elapsedMs(dbStart);
    await refundGenerationCredits(message);
    logTimings('failed', { error: message });
    return { ok: false, error: message };
  }

  // === Stage 6: refresh derived fields + mark complete ===================
  try {
    await syncShowDerivedFieldsForUser(userId, {
      showId,
      showSlug: brief.slug,
    });
  } catch (error) {
    const message = 'Could not finalise the generated show totals.';
    console.error('[cue-generation] derived-field sync failed:', error);
    await markGenerationStatus(supabase, userId, showId, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    timings.dbWriteMs = elapsedMs(dbStart);
    await refundGenerationCredits(message);
    logTimings('failed', { error: message });
    return { ok: false, error: message };
  }

  await markGenerationStatus(supabase, userId, showId, {
    generation_status: 'completed',
    generation_error: null,
    generated_cue_count: accepted.length,
    generation_completed_at: new Date().toISOString(),
  });
  revalidatePath(`/shows/${brief.slug}`);
  revalidatePath(`/shows/${brief.slug}/preview`);
  timings.dbWriteMs = elapsedMs(dbStart);
  await settleGenerationCredits();
  logTimings('completed');

  return { ok: true, cueCount: accepted.length };
}
