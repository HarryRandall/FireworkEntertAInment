import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database } from '@/lib/database.types';
import { DEFAULT_CUE_MODEL, getOpenRouterClient } from '@/lib/openrouter.server';
import {
  MIN_PRODUCT_DURATION_SECONDS,
  findTubeOverlap,
  type CueWindow,
} from '@/lib/cue-overlap.server';
import {
  invalidateShowCacheForUser,
  listFireworkProducts,
  syncShowDerivedFieldsForUser,
} from '@/lib/shows.server';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { buildCueSlots, type CueSlot } from '@/lib/beat-grid.server';

type AppSupabase = SupabaseClient<Database>;

export type GenerateCuesResult = { ok: true; cueCount: number } | { ok: false; error: string };

const AssignmentSchema = z.object({
  slotIndex: z.number().int().min(0),
  productId: z.string().uuid(),
  description: z.string().trim().min(1).max(180),
});

const GenerationResponseSchema = z.object({
  cues: z.array(AssignmentSchema).min(1).max(240),
  rationale: z.string().optional(),
});

type Assignment = z.infer<typeof AssignmentSchema>;

type ShowBriefRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  budget_cents: number | null;
  time_of_day: string | null;
  location: string | null;
  mood_tags: string[] | null;
  music_analysis_id: string | null;
};

function buildAnalysisSummary(analysis: AnalyserResult | null, durationSeconds: number) {
  if (!analysis) {
    return {
      note: 'No AI song analysis was available; cues were timed against a synthetic 120 BPM grid.',
      durationSeconds,
    };
  }
  return {
    durationSeconds: analysis.duration_seconds || durationSeconds,
    tempoBpm: analysis.tempo_bpm,
    musicProfile: analysis.music_profile,
    showPersonality: analysis.show_personality,
    sections: analysis.sections,
    climaxes: analysis.key_moments?.filter((m) => m.type === 'climax'),
    buildups: analysis.buildups,
  };
}

function projectCatalogue(products: Awaited<ReturnType<typeof listFireworkProducts>>) {
  // Single-shot only — multi-shot cakes occupy a tube for many seconds.
  const singleShot = products.filter((p) => p.shotCount === 1);
  return singleShot.map((product) => {
    const spec = product.spec ?? null;
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      durationSeconds: product.durationSeconds,
      heightMeters: product.heightMeters,
      caliber: product.caliber,
      shellType: spec?.shellType ?? null,
      color: spec?.color ?? null,
      colorPalette: spec?.colorPalette ?? null,
      effects: {
        glitter: spec?.glitter ?? null,
        trailEffect: spec?.trailEffect ?? null,
        crackle: spec?.crackle ?? false,
        strobe: spec?.strobe ?? false,
        ring: spec?.ring ?? false,
        crossette: spec?.crossette ?? false,
        horsetail: spec?.horsetail ?? false,
      },
    };
  });
}

function buildSystemPrompt(): string {
  return [
    'You are a senior pyrotechnic show designer choreographing a song with single-shot fireworks.',
    "The user has written a 'userPrompt' describing the show they want — treat it as the single most important creative direction. Honour it over every other heuristic.",
    '',
    'Inputs you receive:',
    "  - userPrompt: the user's verbatim creative brief. Always re-read it before assigning cues.",
    '  - brief: title, mood tags, budget, time of day, location, requested duration.',
    '  - analysisSummary: full song structure — duration, tempo, sections (start/end/label/energy), climaxes, buildups, music_profile, show_personality.',
    "  - beatGrid: every analysed beat with { t (sec), section, vibe, intensity, climax }. This is your high-resolution timing reference — use it to feel the song's pacing.",
    '  - catalogue: every available SINGLE-SHOT product with id, name, description, durationSeconds, caliber, heightMeters, shellType, color, colorPalette, and effect flags (glitter, trailEffect, crackle, strobe, ring, crossette, horsetail).',
    '  - slots: a dense beat grid sampled from the actual analysed beats. Each slot is { i (index), t (seconds), tube (0|1|2), v (vibe), e (intensity 0-1), climax, section }. Slots are the ONLY times you can fire on. Their intensity e and vibe v are your high-resolution pacing reference — use them to feel the song.',
    '',
    'Output: assign at most one product per slot. Return { cues: [{ slotIndex, productId, description }], rationale }.',
    '',
    'Hard rules:',
    '  - slotIndex MUST exist in the slots array. Never invent indices.',
    '  - productId MUST be a catalogue id. Never invent ids.',
    '  - You do NOT choose the time or tube — they come from the slot you pick.',
    '  - One cue per slotIndex, no duplicates.',
    '',
    'Pacing rules (this is the biggest quality lever — get it right):',
    "  - The show must FEEL like the song. Cue density and product size should track each slot's intensity e, not just be uniformly dense.",
    '  - First 10–15% of the song (intro / first verse): VERY sparse. Maybe one cue every 4–8 seconds. Small caliber, single colour, elegant. This is the breath before the build.',
    '  - Buildups: ramp deliberately. Earlier buildup beats should still feel restrained; only the final 2–3 seconds before a climax should hit full intensity. The audience should feel tension rising.',
    '  - Choruses / drops / climaxes: dense, fast, biggest catalogue items. Stack multiple tubes on the same beat where slots allow. Use crackle/strobe/multi-colour combos here.',
    "  - Verses after a chorus: pull back to ~50% density. Don't keep the climax energy flat across the whole song or the finale loses meaning.",
    "  - Outro / finale: either a big sustained finale wall (if the song ends loud) or a graceful tapering set of single shells (if it ends soft). Match the song's actual ending energy from the slot intensities.",
    '  - Target overall fill: 70–90% of slots. A masterful show LEAVES SPACE — better to skip a slot than to spam.',
    '',
    'Creative direction:',
    "  - The userPrompt overrides defaults. If they say 'mostly green', favour green; if they say 'patriotic', red/white/blue with gold finishers; if they say 'minimalist', drop the fill ratio toward 65%.",
    "  - Match each cue's product to its slot vibe AND to the userPrompt palette.",
    "  - Rotate through the catalogue — don't repeat the same product back-to-back unless it's a deliberate motif (e.g. matching the chorus hook).",
    "  - description: ≤ 180 chars, one sentence, says WHAT fires and WHY this beat (e.g. 'Twin gold willows on the snare hit before the drop').",
    '  - rationale: 2–4 sentences explaining the overall structure you chose and how it serves the userPrompt.',
    '',
    'Output schema (return EXACTLY this JSON shape, no prose, no markdown fences):',
    '  { "cues": [{ "slotIndex": <int>, "productId": "<uuid>", "description": "<string ≤180 chars>" }, ...], "rationale": "<string>" }',
    'Constraints: cues.length 1–240. Every slotIndex must exist in slots. Every productId must exist in catalogue. No duplicate slotIndex. Return ONLY the JSON object, nothing else.',
  ].join('\n');
}

function extractProviderError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const anyErr = error as {
    error?: { message?: unknown; metadata?: { raw?: unknown } };
    response?: { data?: unknown };
  };
  const fromError = anyErr.error?.message;
  if (typeof fromError === 'string' && fromError) return fromError;
  const rawMeta = anyErr.error?.metadata?.raw;
  if (typeof rawMeta === 'string' && rawMeta) return rawMeta.slice(0, 400);
  const data = anyErr.response?.data;
  if (typeof data === 'string' && data) return data.slice(0, 400);
  if (data && typeof data === 'object') {
    try {
      return JSON.stringify(data).slice(0, 400);
    } catch {
      return null;
    }
  }
  return null;
}

// Some models wrap JSON in markdown fences (```json ... ```) despite the
// system prompt asking for raw JSON. Strip the fence before parsing.
function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function projectSlotsForLLM(slots: CueSlot[]) {
  // Compact projection to control tokens (~12 chars per slot).
  return slots.map((s) => ({
    i: s.index,
    t: s.time,
    tube: s.tube,
    v: s.vibe,
    e: Number(s.intensity.toFixed(2)),
    climax: s.nearClimax ? 1 : 0,
    section: s.sectionLabel,
  }));
}

async function loadBrief(
  supabase: AppSupabase,
  userId: string,
  showId: string,
): Promise<ShowBriefRow | null> {
  const { data, error } = await supabase
    .from('shows')
    .select(
      'id, slug, title, description, duration_seconds, budget_cents, time_of_day, location, mood_tags, music_analysis_id',
    )
    .eq('id', showId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[cue-generation] loadBrief failed:', error);
    return null;
  }
  return (data as ShowBriefRow) ?? null;
}

async function loadAnalysisJson(
  supabase: AppSupabase,
  musicAnalysisId: string,
): Promise<AnalyserResult | null> {
  const { data, error } = await supabase
    .from('music_analyses')
    .select('analysis_json, status')
    .eq('id', musicAnalysisId)
    .maybeSingle();
  if (error) {
    console.error('[cue-generation] loadAnalysisJson failed:', error);
    return null;
  }
  if (data?.status !== 'completed') return null;
  if (!data?.analysis_json) return null;
  return data.analysis_json as unknown as AnalyserResult;
}

async function markGenerationStatus(
  supabase: AppSupabase,
  userId: string,
  showId: string,
  patch: Database['public']['Tables']['shows']['Update'],
) {
  const { error } = await supabase
    .from('shows')
    .update(patch)
    .eq('id', showId)
    .eq('user_id', userId);
  if (error) {
    console.error('[cue-generation] status update failed:', error);
    return;
  }
  const { data: show } = await supabase
    .from('shows')
    .select('slug')
    .eq('id', showId)
    .eq('user_id', userId)
    .maybeSingle();
  await invalidateShowCacheForUser(userId, {
    showId,
    showSlug: show?.slug ?? null,
  });
  if (show?.slug) {
    revalidatePath(`/shows/${show.slug}`);
    revalidatePath(`/shows/${show.slug}/generating`);
    revalidatePath(`/shows/${show.slug}/preview`);
  }
}

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
      // json_object is the widely-supported structured-output mode on
      // OpenRouter (Anthropic + most providers). json_schema is OpenAI-only.
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

  let parsed: z.infer<typeof GenerationResponseSchema>;
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

  // 1. Reconstruct cues from slots, dedupe by slotIndex, validate productId.
  type ReconstructedCue = {
    timeSeconds: number;
    tube: 0 | 1 | 2;
    productId: string;
    description: string;
    slotIndex: number;
    intensity: number;
  };

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

  // 2. Sort and apply tube-overlap dedupe with actual product durations.
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

  // 3. Replace existing show_cues with the new set.
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
