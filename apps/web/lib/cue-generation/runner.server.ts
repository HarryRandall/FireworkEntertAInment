/**
 * Top-level cue-generation runner.
 *
 * Pipeline stages:
 *   1. Load brief, analyser JSON and catalogue; build the beat slot grid.
 *   2. Plan: normal shows get a section plan (from the selected model, or the
 *      deterministic default) realised into timed cues. The Beat precision
 *      style and exact physical packs use the slot planners.
 *   3. Validate the candidate against timing, safety, pack and prompt rules;
 *      only a hard failure falls back to the beat planner.
 *   4. Replace the show's existing `show_timeline_items` with the accepted set.
 *   5. Atomically mark the show `completed` and settle its credit reservation.
 *
 * A database lease fences every write. Retryable failures release the lease
 * with a short back-off; terminal failures atomically fail the show and refund
 * its reservation.
 */
import 'server-only';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/database.types';
import {
  requireExactProductQuantityLedger,
  type ProductQuantityLedger,
} from '@/lib/assortments/constraints';
import { buildCueSlots, type CueSlot } from '@/lib/beat-grid.server';
import { findTubeOverlap, type CueWindow } from '@/lib/cue-overlap.server';
import { DEFAULT_CUE_MODEL } from '@/lib/openrouter.server';
import type { GenerationMode } from '@/lib/prompt-configs';
import { getActivePromptConfig, getShowCueGenerationSettings } from '@/lib/prompt-configs.server';
import { syncShowDerivedFieldsForUser } from '@/lib/shows/mutations.server';
import { listFireworkProducts } from '@/lib/shows/queries.server';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { normalisePersistedCueModel } from '@/lib/cue-models';
import { parseCreativeDirection } from './creative-direction';
import {
  parsePromptConstraints,
  productMatchesPromptConstraints,
  validatePromptConstraints,
  type PromptConstraints,
} from './prompt-constraints';
import {
  loadAnalysisState,
  loadAssortmentCatalogueItemIds,
  loadBrief,
  loadShowAssortmentLedger,
  type AnalysisJsonLoadResult,
} from './loaders.server';
import { requestShowPlan } from './llm-plan.server';
import { realiseShowPlan } from './plan-realiser';
import { evaluateShowMetrics } from './show-metrics';
import { buildDefaultShowPlan, buildPlanSections, describeCataloguePalette } from './show-plan';
import { planCuesFast } from './fast-planner';
import { planCuesOnBeats } from './beat-sync-planner';
import { loadProductTimingProfiles } from './product-timing.server';
import type { ProductTimingProfiles } from './music-product-matching';
import { GENERATED_LAUNCH_INTERVAL_SECONDS } from './launch-spacing';
import { evaluateFinalChoreography } from './quality';
import { evaluateMusicSync } from './music-sync-quality';
import { selectChoreographyCandidate, type ChoreographyPlanner } from './choreography-repair';
import {
  launchPositionsForWidth,
  occupiedLaunchPositions,
  parseFireworkTypes,
  productFitsLaunchPositions,
  productMatchesTypes,
} from './show-options';
import { SHOW_STYLES, asShowStyleKey, isShowStyleKey, type ShowStyleKey } from './show-styles';
import type { CueEmphasis, GenerateCuesResult, ShowBriefRow } from './schemas';

type AppSupabase = SupabaseClient<Database>;
const CUE_GENERATION_LEASE_SECONDS = 900;
const MAX_CUE_GENERATION_ATTEMPTS = 3;
const CUE_RETRY_DELAYS_SECONDS = [30, 120] as const;

type CueGenerationClaim = {
  show_id: string;
  user_id: string;
  music_analysis_id: string | null;
  selected_cue_model: string | null;
  show_style: string;
  credit_action_key: string;
  attempt_count: number;
  lease_token: string;
};

function isRetryableDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown; name?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /\b(?:abort|network|timeout|timed out|fetch failed)\b/i.test(message) ||
    code.startsWith('08') ||
    code.startsWith('53') ||
    code === '40001' ||
    code === '40P01' ||
    code === '55P03' ||
    code === '57P01' ||
    code.startsWith('PGRST')
  );
}

async function classifyUnclaimedCueGeneration(params: {
  supabase: AppSupabase;
  showId?: string;
}): Promise<GenerateCuesResult> {
  if (!params.showId) {
    return { ok: true, pending: true, reason: 'no_generation_ready' };
  }
  const { data: show, error } = await params.supabase
    .from('shows')
    .select(
      'id, user_id, music_analysis_id, generation_status, generation_error, generated_cue_count',
    )
    .eq('id', params.showId)
    .maybeSingle();
  if (error) return { ok: false, error: `Could not inspect cue generation: ${error.message}` };
  if (!show) return { ok: false, error: 'Show not found.' };
  if (show.generation_status === 'completed') {
    return {
      ok: true,
      cueCount: show.generated_cue_count ?? 0,
      showId: show.id,
      userId: show.user_id,
    };
  }
  if (show.generation_status === 'failed') {
    return { ok: false, error: show.generation_error ?? 'Cue generation failed.' };
  }
  if (show.music_analysis_id) {
    const { data: analysis, error: analysisError } = await params.supabase
      .from('song_analyses')
      .select('status')
      .eq('id', show.music_analysis_id)
      .maybeSingle();
    if (analysisError) {
      return { ok: false, error: `Could not inspect music analysis: ${analysisError.message}` };
    }
    if (analysis?.status === 'running') {
      return {
        ok: true,
        pending: true,
        reason: 'music_analysis_running',
        showId: show.id,
        userId: show.user_id,
      };
    }
  }
  return {
    ok: true,
    pending: true,
    reason: 'generation_already_claimed',
    showId: show.id,
    userId: show.user_id,
  };
}

/** Two-decimal rounding that mirrors the `numeric(8,2)` timeline column. */
function toStoredTimeSeconds(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Final guarantee that the persisted set satisfies the database timeline-safety
 * trigger, applied to every planner path (beat, fast, and LLM).
 *
 * The planners avoid overlapping ignitions, but the database stores
 * `time_seconds` as `numeric(8,2)`. Re-checking with database-identical
 * rounding and the shared ignition interval prevents rounding from turning a
 * valid plan into a rejected write.
 */
function enforceTimelineTubeSafety(
  cues: ReconstructedCue[],
  products: Awaited<ReturnType<typeof listFireworkProducts>>,
  maxTubes: 1 | 2 | 3,
): ReconstructedCue[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const ordered = [...cues].sort(compareCuePlanningPriority);
  const kept: ReconstructedCue[] = [];
  const acceptedWindows: CueWindow[] = [];
  for (const cue of ordered) {
    const product = productById.get(cue.productId);
    if (!product) continue;
    const occupiedTubes = occupiedLaunchPositions(product, cue.tube, maxTubes);
    if (!occupiedTubes) continue;
    // Compare on the rounded value the trigger will actually see and reserve
    // the shared ignition interval.
    const storedTime = toStoredTimeSeconds(cue.timeSeconds);
    const windows: CueWindow[] = occupiedTubes.map((launchPositionIndex) => ({
      timeSeconds: storedTime,
      durationSeconds: GENERATED_LAUNCH_INTERVAL_SECONDS,
      launchPositionIndex,
    }));
    if (windows.some((window) => findTubeOverlap(window, acceptedWindows))) continue;
    kept.push({ ...cue, timeSeconds: storedTime });
    acceptedWindows.push(...windows);
  }
  return kept.sort((a, b) => a.timeSeconds - b.timeSeconds || a.tube - b.tube);
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

function compareCuePlanningPriority(a: ReconstructedCue, b: ReconstructedCue): number {
  return (
    cueProtectionPriority(b) - cueProtectionPriority(a) ||
    a.impactTimeSeconds - b.impactTimeSeconds ||
    a.tube - b.tube
  );
}

function cueProtectionPriority(cue: ReconstructedCue): number {
  if (cue.emphasis === 'peak') return 3;
  if (cue.emphasis === 'accent') return 2;
  return 1 + Math.min(0.9, Math.max(0, cue.intensity)) * 0.5;
}

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

/**
 * Generate cues for one explicitly requested show, or claim the next ready
 * show when invoked by the reconciliation worker.
 */
export async function generateCuesForShow(params: {
  supabase: AppSupabase;
  userId?: string;
  showId?: string;
  musicAnalysisId?: string | null;
  selectedCueModel?: string | null;
  generationMode?: GenerationMode | 'beat';
}): Promise<GenerateCuesResult> {
  const { supabase } = params;
  let generationSettings: Awaited<ReturnType<typeof getShowCueGenerationSettings>>;
  try {
    generationSettings = await getShowCueGenerationSettings();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not load cue generation settings: ${message}` };
  }
  const { data: claimedRows, error: claimError } = await supabase.rpc(
    'claim_cue_generation_attempt',
    {
      p_show_id: params.showId,
      p_lease_seconds: CUE_GENERATION_LEASE_SECONDS,
      p_max_attempts: MAX_CUE_GENERATION_ATTEMPTS,
    },
  );
  if (claimError) {
    return { ok: false, error: `Could not claim cue generation: ${claimError.message}` };
  }
  const claim = (claimedRows?.[0] ?? null) as CueGenerationClaim | null;
  if (!claim) {
    return classifyUnclaimedCueGeneration({
      supabase,
      showId: params.showId,
    });
  }
  if (params.userId && params.userId !== claim.user_id) {
    return { ok: false, error: 'Cue generation owner did not match the claimed show.' };
  }

  const userId = claim.user_id;
  const showId = claim.show_id;
  const musicAnalysisId = claim.music_analysis_id;
  const selectedCueModel = claim.selected_cue_model ?? params.selectedCueModel;
  let model = normalisePersistedCueModel(selectedCueModel, DEFAULT_CUE_MODEL);
  // The global setting decides fast vs LLM for normal styles. The dedicated
  // Beat precision style remains a deterministic override.
  let generationMode: GenerationMode | 'beat' =
    claim.show_style === 'beat_test'
      ? 'beat'
      : claim.credit_action_key === 'show_generation_fast'
        ? 'fast'
        : selectedCueModel
          ? 'llm'
          : (params.generationMode ?? generationSettings.generationMode);
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
  const finishFailure = async (message: string, retryable = false): Promise<GenerateCuesResult> => {
    const runtimeMs = elapsedMs(totalStart);
    if (retryable && claim.attempt_count < MAX_CUE_GENERATION_ATTEMPTS) {
      const retryDelay =
        CUE_RETRY_DELAYS_SECONDS[
          Math.min(claim.attempt_count - 1, CUE_RETRY_DELAYS_SECONDS.length - 1)
        ] ?? CUE_RETRY_DELAYS_SECONDS[CUE_RETRY_DELAYS_SECONDS.length - 1];
      const { data: scheduled, error } = await supabase.rpc('schedule_cue_generation_retry', {
        p_show_id: showId,
        p_lease_token: claim.lease_token,
        p_error_message: message,
        p_runtime_ms: runtimeMs,
        p_retry_delay_seconds: retryDelay,
      });
      if (!error && scheduled) {
        return {
          ok: true,
          pending: true,
          reason: 'cue_generation_retry_scheduled',
          showId,
          userId,
        };
      }
      if (error) {
        console.error('[cue-generation] retry scheduling failed:', error);
      }
    }

    const { data: failed, error } = await supabase.rpc('fail_cue_generation_attempt', {
      p_show_id: showId,
      p_lease_token: claim.lease_token,
      p_error_message: message,
      p_runtime_ms: runtimeMs,
      p_dead_letter: retryable,
    });
    if (error || !failed) {
      console.error('[cue-generation] terminal state persistence failed:', error);
      return {
        ok: false,
        error: `${message} The generation lease will be reconciled.`,
      };
    }
    return { ok: false, error: message };
  };

  // === Stage 1: load + validate inputs ====================================
  let brief: ShowBriefRow | null;
  let analysis: AnalyserResult | null = null;
  let analysisResult: AnalysisJsonLoadResult = { status: 'absent', analysis: null };
  let products: Awaited<ReturnType<typeof listFireworkProducts>> = [];
  let timingProfiles: ProductTimingProfiles = new Map();
  let assortmentLedger: ProductQuantityLedger | null = null;
  let liveAssortmentItemIds: Set<string> | null = null;
  let slots: CueSlot[];
  let promptConstraints: PromptConstraints = parsePromptConstraints('');

  const loadStart = performance.now();
  try {
    [brief, analysisResult] = await Promise.all([
      loadBrief(supabase, userId, showId),
      musicAnalysisId
        ? loadAnalysisState(supabase, musicAnalysisId)
        : Promise.resolve({ status: 'absent', analysis: null } satisfies AnalysisJsonLoadResult),
    ]);
    if (!brief) throw new Error('Show not found.');
    promptConstraints = parsePromptConstraints(brief.description ?? '');
    if (brief.creation_source === 'assortment_qr') {
      assortmentLedger = await loadShowAssortmentLedger(supabase, showId);
    } else if (brief.assortment_id) {
      liveAssortmentItemIds = await loadAssortmentCatalogueItemIds(supabase, brief.assortment_id);
    }
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
      } else if (analysisResult.status === 'invalid') {
        throw new Error(
          `Stored music analysis is invalid. Please upload the song again: ${analysisResult.errorMessage}`,
        );
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
    if (assortmentLedger) {
      products = products.filter((product) => assortmentLedger?.has(product.id));
      if (products.length !== assortmentLedger.size) {
        throw new Error(
          'One or more products in the physical assortment cannot be rendered safely.',
        );
      }
    } else {
      // Normal app generation still requires a purchasable supplier item. A QR
      // assortment is already a fixed physical pack, so its immutable snapshot
      // is the availability authority instead of live supplier inventory.
      products = products.filter((product) => product.minPriceCents != null);
      if (products.length === 0) {
        throw new Error('No purchasable fireworks are available from supplier inventory.');
      }
    }
    // Multishot child positions are absolute. Products that address a launch
    // position outside this site's width cannot be scheduled safely.
    products = products.filter((product) => productFitsLaunchPositions(product, maxTubes));
    if (products.length === 0) {
      throw new Error('No catalogue products fit the launch positions available at this site.');
    }
    if (assortmentLedger && products.length !== assortmentLedger.size) {
      throw new Error(
        'The physical assortment cannot be scheduled safely at the available launch positions.',
      );
    }
    // Firework-type choices are explicit user constraints, not preferences.
    // Never silently restore excluded product families when the result is
    // small: a sparse truthful catalogue is better than a contradictory show.
    const allowedTypes = parseFireworkTypes(brief.firework_types);
    if (allowedTypes) {
      const filtered = products.filter((product) => productMatchesTypes(product, allowedTypes));
      if (filtered.length === 0) {
        throw new Error('No available fireworks match the requested firework types.');
      }
      products = filtered;
    }
    const promptMatchedProducts = products.filter((product) =>
      productMatchesPromptConstraints(product, promptConstraints),
    );
    if (promptMatchedProducts.length === 0) {
      throw new Error('No available fireworks satisfy the required prompt constraints.');
    }
    products = promptMatchedProducts;
    if (assortmentLedger && products.length !== assortmentLedger.size) {
      throw new Error('The physical assortment cannot satisfy the requested show constraints.');
    }
    const unavailablePromptRequirements = validatePromptConstraints({
      productIds: products.map((product) => product.id),
      products,
      constraints: promptConstraints,
    }).filter(
      (violation) => violation.kind === 'missing_colour' || violation.kind === 'missing_effect',
    );
    if (unavailablePromptRequirements.length > 0) {
      const missing = unavailablePromptRequirements.map((violation) => violation.value).join(', ');
      throw new Error(
        `The available catalogue cannot satisfy the requested ${missing} constraint.`,
      );
    }
    // Apply an assortment boundary for every assortment-backed show. Public
    // QR shows use their immutable physical-pack snapshot, while normal app
    // shows use the current assortment membership loaded above.
    const requiredAssortmentItemIds = assortmentLedger
      ? new Set(assortmentLedger.keys())
      : liveAssortmentItemIds;
    if (requiredAssortmentItemIds) {
      products = products.filter((product) => requiredAssortmentItemIds.has(product.id));
      if (products.length === 0) {
        throw new Error('This assortment has no purchasable products available right now.');
      }
    }
    catalogueCount = products.length;
    timingProfiles = await loadProductTimingProfiles(supabase, products);
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
    logTimings('failed', { error: message });
    return finishFailure(message);
  }

  let accepted: ReconstructedCue[] = [];
  let plannerUsed: ChoreographyPlanner = generationMode;
  try {
    const songDuration = analysis?.duration_seconds ?? brief.duration_seconds ?? 0;
    const creativeDirection = parseCreativeDirection(
      [brief.title, brief.description, ...(brief.mood_tags ?? [])].filter(Boolean).join(' '),
      asShowStyleKey(brief.show_style),
    );
    const sparseGeneration = showStyle === 'minimalist' || creativeDirection.density === 'sparse';

    /** Deterministic beat planner: the Beat precision style and the rescue path. */
    const buildBeatPlan = () => {
      const planStart = performance.now();
      const plan = planCuesOnBeats({
        analysis,
        slots,
        products,
        songDuration,
        brief,
        maxTubes,
        availabilityByProductId: assortmentLedger,
        timingProfiles,
      });
      timings.fastPlanMs = elapsedMs(planStart);
      return plan;
    };

    // Every candidate crosses the same persisted-time, physical-pack and
    // prompt boundary before it can be compared.
    const productById = new Map(products.map((product) => [product.id, product]));
    const inspectCandidate = (candidate: ReconstructedCue[], candidateSlots: CueSlot[]) => {
      const slotIds = new Set(candidateSlots.map((slot) => slot.index));
      if (
        candidate.some(
          (cue) =>
            !productById.has(cue.productId) ||
            !slotIds.has(cue.slotIndex) ||
            !Number.isFinite(cue.timeSeconds) ||
            cue.timeSeconds < 0 ||
            !Number.isFinite(cue.impactTimeSeconds) ||
            cue.impactTimeSeconds < 0,
        )
      ) {
        throw new Error('Invalid product, slot or launch time in choreography candidate.');
      }
      const safe = requireExactProductQuantityLedger(
        enforceTimelineTubeSafety(candidate, products, maxTubes),
        assortmentLedger,
        'Final cue validation',
      );
      const musicSync = evaluateMusicSync({
        cues: safe,
        slots: candidateSlots,
        analysis,
        timingProfiles,
      });
      const qualityCues = safe.map((cue) => {
        const profile = timingProfiles.get(cue.productId)?.[cue.emphasis];
        const firstImpact =
          profile?.completeness === 'complete' ? profile.firstImpactOffsetSeconds : null;
        return firstImpact == null
          ? cue
          : { ...cue, impactTimeSeconds: cue.timeSeconds + firstImpact };
      });
      return {
        cues: safe,
        quality: evaluateFinalChoreography({
          cues: qualityCues,
          slots: candidateSlots,
          promptViolations: validatePromptConstraints({
            productIds: safe.map((cue) => cue.productId),
            products,
            constraints: promptConstraints,
          }),
          maxTubes,
          sparse: sparseGeneration,
          musicSync,
          activityWindows: safe.flatMap((cue) => {
            const profile = timingProfiles.get(cue.productId)?.[cue.emphasis];
            return profile?.completeness === 'complete'
              ? profile.shots.map((shot) => ({
                  start: cue.timeSeconds + shot.impactOffsetSeconds,
                  end: cue.timeSeconds + shot.endOffsetSeconds,
                }))
              : [{ start: cue.impactTimeSeconds, end: cue.impactTimeSeconds }];
          }),
        }),
      };
    };

    // Exact physical packs need exact quantity placement, which only the
    // slot planners provide. Every other show uses the section plan.
    const usePlanRealiser = generationMode !== 'beat' && assortmentLedger == null;
    let planReport: Record<string, unknown> | null = null;

    if (usePlanRealiser) {
      // === Stage 2: section plan (model or default) + deterministic realiser
      const sections = buildPlanSections(analysis, songDuration);
      const palette = describeCataloguePalette(products);
      const defaultPlan = buildDefaultShowPlan({
        sections,
        direction: creativeDirection,
        constraints: promptConstraints,
        palette,
      });
      let plan = defaultPlan;
      let llmFailure: string | null = null;
      if (generationMode === 'llm') {
        const promptStart = performance.now();
        const promptConfig = await getActivePromptConfig('show_cue_generation');
        timings.promptBuildMs = elapsedMs(promptStart);
        const outcome = await requestShowPlan({
          model,
          userPrompt: brief.description ?? '',
          brief: {
            title: brief.title,
            moodTags: brief.mood_tags ?? [],
            timeOfDay: brief.time_of_day,
            location: brief.location,
            budgetUsd: brief.budget_cents != null ? Math.round(brief.budget_cents / 100) : null,
            showStyle: showStyle ? SHOW_STYLES[showStyle].name : null,
            launchPositions: maxTubes,
            fireworkTypes: parseFireworkTypes(brief.firework_types),
          },
          analysis,
          songDuration,
          sections,
          fallback: defaultPlan,
          palette,
          products,
          constraints: promptConstraints,
          showStyle,
          promptConfig,
          productCatalogueFields: generationSettings.productCatalogueFields,
        });
        plan = outcome.plan;
        llmFailure = outcome.failure;
        promptBytes = outcome.promptBytes;
        rawResponseBytes = outcome.responseBytes;
        timings.openRouterMs = outcome.durationMs;
        if (llmFailure) {
          console.error('[cue-generation] model plan unavailable, using the default plan:', {
            model,
            error: llmFailure,
          });
        }
      }

      const realiseStart = performance.now();
      const realised = realiseShowPlan({
        plan,
        sections,
        analysis,
        songDuration,
        products,
        timingProfiles,
        maxTubes,
        constraints: promptConstraints,
      });
      timings.fastPlanMs = elapsedMs(realiseStart);
      const finaleIndex = plan.sections.findIndex((direction) => direction.role === 'finale');
      planReport = {
        planSource: plan.source,
        llmFailure,
        roles: plan.sections.map((direction) => direction.role),
        metrics: evaluateShowMetrics({
          cues: realised.cues,
          analysis,
          songDuration,
          finaleStartSeconds: finaleIndex >= 0 ? (sections[finaleIndex]?.start ?? null) : null,
          timingProfiles,
        }),
      };

      // Lulls and gaps are deliberate here, so only hard failures (missing
      // final hit, unmet prompt requirement, invalid output) fall back.
      let selected: ReturnType<typeof inspectCandidate> | null = null;
      try {
        const checked = inspectCandidate(realised.cues, realised.slots);
        if (checked.cues.length && !checked.quality.issues.some((issue) => issue.hard)) {
          selected = checked;
        } else {
          planReport.rejected = checked.quality.issues.map((issue) => issue.kind);
        }
      } catch (error) {
        planReport.rejected = error instanceof Error ? error.message : String(error);
      }
      if (selected) {
        accepted = selected.cues;
      } else {
        const rescue = inspectCandidate(buildBeatPlan().cues, slots);
        if (!rescue.cues.length || rescue.quality.issues.some((issue) => issue.hard)) {
          throw new Error(
            'No choreography candidate satisfied the product, timing, safety and required musical conditions.',
          );
        }
        accepted = rescue.cues;
        plannerUsed = 'beat';
      }
      console.info('[cue-generation] show plan', { ...planReport, selectedPlanner: plannerUsed });
    } else {
      // === Stage 2: slot planners (Beat precision style, exact packs) =====
      const initial =
        generationMode === 'fast'
          ? (() => {
              const planStart = performance.now();
              const plan = planCuesFast({
                brief,
                analysis,
                slots,
                products,
                songDuration,
                availabilityByProductId: assortmentLedger,
                timingProfiles,
              });
              timings.fastPlanMs = elapsedMs(planStart);
              return plan;
            })()
          : buildBeatPlan();
      plannerUsed = generationMode === 'fast' ? 'fast' : 'beat';
      const selection = selectChoreographyCandidate({
        initialCues: initial.cues,
        initialPlanner: plannerUsed,
        createRepair: () => buildBeatPlan().cues,
        inspect: (cues) => inspectCandidate(cues, slots),
      });
      console.info('[cue-generation] choreography candidate evaluation', selection.report);
      if (!selection.selected) {
        throw new Error(
          'No choreography candidate satisfied the product, timing, safety, exact assortment and required musical conditions.',
        );
      }
      accepted = selection.selected.cues;
      plannerUsed = selection.selected.planner;
    }
    acceptedCount = accepted.length;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Cue planning failed: ${detail}`;
    logTimings('failed', { error: message });
    return finishFailure(message, true);
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

  let replacedCount: number | null = null;
  try {
    const { data, error: replaceError } = await supabase.rpc(
      'replace_generated_show_timeline_items',
      {
        p_show_id: showId,
        p_user_id: userId,
        p_items: rows as Json,
        p_lease_token: claim.lease_token,
      },
    );
    if (replaceError) {
      const message = `Could not replace generated cues: ${replaceError.message}`;
      timings.dbWriteMs = elapsedMs(dbStart);
      logTimings('failed', { error: message });
      return finishFailure(message, isRetryableDatabaseError(replaceError));
    }
    replacedCount = data;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Could not replace generated cues: ${detail}`;
    timings.dbWriteMs = elapsedMs(dbStart);
    logTimings('failed', { error: message });
    return finishFailure(message, isRetryableDatabaseError(error));
  }
  if (replacedCount !== rows.length) {
    const message = `Cue replacement wrote ${replacedCount ?? 0} of ${rows.length} cues.`;
    timings.dbWriteMs = elapsedMs(dbStart);
    logTimings('failed', { error: message });
    return finishFailure(message, true);
  }

  // === Stage 6: refresh derived fields + mark complete ===================
  try {
    await syncShowDerivedFieldsForUser(
      userId,
      {
        showId,
        showSlug: brief.slug,
        fixedTotalCents:
          brief.creation_source === 'assortment_qr' || brief.assortment_id
            ? brief.budget_cents
            : undefined,
      },
      supabase,
    );
  } catch (error) {
    const message = 'Could not finalise the generated show totals.';
    console.error('[cue-generation] derived-field sync failed:', error);
    timings.dbWriteMs = elapsedMs(dbStart);
    logTimings('failed', { error: message });
    return finishFailure(message, true);
  }

  const { data: completed, error: completionError } = await supabase.rpc(
    'complete_cue_generation_attempt',
    {
      p_show_id: showId,
      p_lease_token: claim.lease_token,
      p_cue_count: accepted.length,
      p_runtime_ms: elapsedMs(totalStart),
    },
  );
  if (completionError) {
    console.error('[cue-generation] completion persistence failed:', completionError);
    return {
      ok: false,
      error: 'Could not persist cue generation completion. The lease will be reconciled.',
    };
  }
  if (!completed) {
    return classifyUnclaimedCueGeneration({ supabase, showId });
  }
  try {
    revalidatePath(`/shows/${brief.slug}`);
    revalidatePath(`/shows/${brief.slug}/preview`);
  } catch (error) {
    // Completion is already committed. A cache invalidation problem must not
    // reclassify durable generation as failed.
    console.error('[cue-generation] path revalidation failed:', error);
  }
  timings.dbWriteMs = elapsedMs(dbStart);
  logTimings('completed');

  return { ok: true, cueCount: accepted.length, showId, userId };
}
