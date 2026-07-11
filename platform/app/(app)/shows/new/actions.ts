'use server';

/** Server actions powering the new-show wizard: kicking off the audio analyser and creating the show row. */

import { cookies } from 'next/headers';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { slugifyTitle } from '@/lib/show-domain';
import { parseCover, randomCover } from '@/lib/cover';
import { invalidateShowCacheForUser, invalidateShowsCacheForUser } from '@/lib/shows.server';
import { generateCuesForShow } from '@/lib/cue-generation.server';
import { getShowCueGenerationSettings } from '@/lib/prompt-configs.server';
import { DEFAULT_SHOW_STYLE, SHOW_STYLES, SHOW_STYLE_KEYS } from '@/lib/cue-generation/show-styles';
import {
  FIREWORK_TYPE_KEYS,
  MAX_SITE_WIDTH_FEET,
  MIN_SITE_WIDTH_FEET,
} from '@/lib/cue-generation/show-options';
import { DEFAULT_CUE_MODEL } from '@/lib/openrouter.server';
import { CUE_MODEL_OPTIONS, FALLBACK_CUE_MODEL, normaliseCueModel } from '@/lib/cue-models';
import {
  creditActionForGenerationMode,
  getAiCreditCost,
  reserveAiCredits,
  showGenerationReservationKey,
  type AiCreditActionKey,
} from '@/lib/ai-credits.server';
import type { ShowGenerationPresentation } from './types';

const DURATION_TO_SECONDS: Record<string, number> = {
  '1 minute': 60,
  '2 minutes': 120,
  '3 minutes': 180,
  '5 minutes': 300,
  '10 minutes': 600,
};

function parseDurationSeconds(duration: string) {
  if (DURATION_TO_SECONDS[duration] != null) return DURATION_TO_SECONDS[duration];

  const trimmed = duration.trim();

  // Precise seconds, e.g. "252 seconds". Sent by the wizard's "match the
  // track" option so the show runs for the exact length of the uploaded audio.
  const secondsMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+seconds?$/i);
  if (secondsMatch) {
    const seconds = Number(secondsMatch[1]);
    if (!Number.isFinite(seconds) || seconds < 1) return null;
    return Math.round(seconds);
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s+minutes?$/i);
  if (!match) return null;

  const minutes = Number(match[1]);
  if (!Number.isFinite(minutes) || minutes < 1 / 60 || minutes > 60) return null;
  return Math.round(minutes * 60);
}

const NewShowSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  vibe: z.string().trim().max(280).optional(),
  budget: z.coerce.number().int().min(50).max(5000),
  duration: z.string().min(1),
  timeOfDay: z.enum(['Daytime', 'Dusk', 'Night']),
  location: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  moodTags: z.array(z.string().min(1).max(40)).max(20),
  showStyle: z.enum(SHOW_STYLE_KEYS).catch(DEFAULT_SHOW_STYLE),
  siteWidthFeet: z.coerce
    .number()
    .int()
    .min(MIN_SITE_WIDTH_FEET)
    .max(MAX_SITE_WIDTH_FEET)
    .optional(),
  selectedCueModel: z.string().trim().max(120).optional(),
  expectedGenerationMode: z.enum(['fast', 'llm']).optional(),
  fireworkTypes: z.array(z.enum(FIREWORK_TYPE_KEYS)).max(FIREWORK_TYPE_KEYS.length).optional(),
  audioPath: z.string().trim().max(300).optional(),
  musicAnalysisId: z.string().uuid().optional(),
  desiredSlug: z.string().trim().max(120).optional(),
  coverShader: z.string().trim().max(20_000).optional(),
});

export type NewShowResult = { ok: true; slug: string } | { ok: false; error: string };

export type ShowGenerationPresentationResult =
  | { ok: true; presentation: ShowGenerationPresentation }
  | { ok: false; error: string };

/** Return only the customer-facing generation mode and current credit costs.
 * Prompt text and other admin settings remain server-only. */
export async function getShowGenerationPresentationAction(): Promise<ShowGenerationPresentationResult> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: 'Sign in again to load generation options.' };
  }

  const generationSettings = await getShowCueGenerationSettings();
  const defaultCueModel = DEFAULT_CUE_MODEL.trim().slice(0, 120) || FALLBACK_CUE_MODEL;
  const modelActionKeys = new Map(
    [...new Set([...CUE_MODEL_OPTIONS.map((option) => option.value), defaultCueModel])].map(
      (model) => [model, creditActionForGenerationMode('llm', model)],
    ),
  );
  const actionKeys = Array.from(
    new Set<AiCreditActionKey>(['show_generation_fast', ...modelActionKeys.values()]),
  );
  const costs = await Promise.all(actionKeys.map((key) => getAiCreditCost(supabase, key)));
  const costByAction = new Map(costs.map((cost) => [cost.key, cost.amount]));

  return {
    ok: true,
    presentation: {
      generationMode: generationSettings.generationMode,
      defaultCueModel,
      fastCreditCost: costByAction.get('show_generation_fast') ?? 1,
      modelCreditCosts: Object.fromEntries(
        Array.from(modelActionKeys, ([model, actionKey]) => [
          model,
          costByAction.get(actionKey) ?? 1,
        ]),
      ),
    },
  };
}

function isUserAudioPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes('..');
}

function parseClientCover(value: string | undefined) {
  if (!value) return null;
  try {
    return parseCover(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function createShowAction(formData: FormData): Promise<NewShowResult> {
  const supabase = createClient(await cookies());

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: 'You must be signed in to create a show.' };
  }

  const parsed = NewShowSchema.safeParse({
    title: formData.get('title') ?? '',
    vibe: formData.get('vibe') ?? '',
    budget: formData.get('budget'),
    duration: formData.get('duration') ?? '',
    timeOfDay: formData.get('timeOfDay') ?? '',
    location: formData.get('location') ?? '',
    description: formData.get('description') ?? '',
    moodTags: formData.getAll('moodTags').map(String),
    showStyle: formData.get('showStyle') ?? DEFAULT_SHOW_STYLE,
    siteWidthFeet: formData.get('siteWidthFeet') ?? undefined,
    selectedCueModel: formData.get('selectedCueModel') ?? undefined,
    expectedGenerationMode: formData.get('expectedGenerationMode') ?? undefined,
    fireworkTypes: formData.getAll('fireworkTypes').map(String),
    audioPath: formData.get('audioPath') ?? undefined,
    musicAnalysisId: formData.get('musicAnalysisId') ?? undefined,
    desiredSlug: formData.get('desiredSlug') ?? undefined,
    coverShader: formData.get('coverShader') ?? undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? 'Please fill out all required fields.',
    };
  }

  if (
    parsed.data.showStyle === 'beat_test' &&
    parsed.data.fireworkTypes?.length &&
    !parsed.data.fireworkTypes.includes('aerial_shells')
  ) {
    return { ok: false, error: 'Beat precision needs Aerial shells selected.' };
  }

  let audioPath = parsed.data.audioPath || null;
  const musicAnalysisId = parsed.data.musicAnalysisId || null;
  const requestedCueModel = normaliseCueModel(parsed.data.selectedCueModel, DEFAULT_CUE_MODEL);

  if (musicAnalysisId) {
    const { data: analysis, error: analysisError } = await supabase
      .from('song_analyses')
      .select('id, audio_path')
      .eq('id', musicAnalysisId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (analysisError || !analysis) {
      console.error('[createShowAction] music analysis lookup failed:', analysisError);
      return { ok: false, error: 'Could not attach the uploaded music.' };
    }
    audioPath = analysis.audio_path;
  } else if (audioPath) {
    if (!isUserAudioPath(audioPath, user.id)) {
      return { ok: false, error: 'Uploaded audio path is invalid.' };
    }
  }

  const baseSlug = parsed.data.desiredSlug
    ? slugifyTitle(parsed.data.desiredSlug)
    : slugifyTitle(parsed.data.title);
  const durationSeconds = parseDurationSeconds(parsed.data.duration);
  const coverShader = parseClientCover(parsed.data.coverShader) ?? randomCover();
  const generationSettings = await getShowCueGenerationSettings();
  if (
    parsed.data.expectedGenerationMode &&
    parsed.data.expectedGenerationMode !== generationSettings.generationMode
  ) {
    return {
      ok: false,
      error:
        'Generation settings changed while this show was being prepared. Review and try again.',
    };
  }
  const generationMode =
    SHOW_STYLES[parsed.data.showStyle].engine === 'beat'
      ? 'beat'
      : generationSettings.generationMode;
  const selectedCueModel = generationMode === 'llm' ? requestedCueModel : null;

  // Avoid clashing with an existing slug for the same user.
  let slug = baseSlug;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: existing } = await supabase
      .from('shows')
      .select('id')
      .eq('user_id', user.id)
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: show, error: insertError } = await supabase
    .from('shows')
    .insert({
      user_id: user.id,
      slug,
      title: parsed.data.title,
      description: parsed.data.description || parsed.data.vibe || null,
      duration_seconds: durationSeconds,
      budget_cents: parsed.data.budget * 100,
      time_of_day: parsed.data.timeOfDay,
      location: parsed.data.location || null,
      mood_tags: parsed.data.moodTags,
      show_style: parsed.data.showStyle,
      site_width_feet: parsed.data.siteWidthFeet ?? null,
      selected_cue_model: selectedCueModel,
      firework_types: parsed.data.fireworkTypes?.length ? parsed.data.fireworkTypes : null,
      audio_path: audioPath,
      music_analysis_id: musicAnalysisId,
      cover_shader: coverShader,
      status: 'draft',
      generation_status: 'running',
      generation_started_at: new Date().toISOString(),
    })
    .select('id, slug')
    .single();

  if (insertError || !show) {
    console.error('[createShowAction] insert failed:', insertError);
    return { ok: false, error: 'Could not save your show. Please try again.' };
  }

  const reservation = await reserveAiCredits(supabase, {
    userId: user.id,
    actionKey: creditActionForGenerationMode(generationMode, selectedCueModel ?? undefined),
    referenceType: 'shows',
    referenceId: show.id,
    reservationKey: showGenerationReservationKey(show.id),
    metadata: {
      durationSeconds,
      generationMode,
      model: selectedCueModel,
      showStyle: parsed.data.showStyle,
    },
  });

  if (!reservation.ok) {
    const { data: removedShow, error: cleanupError } = await supabase
      .from('shows')
      .delete()
      .eq('id', show.id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();
    if (cleanupError || !removedShow) {
      console.error('[createShowAction] credit reservation cleanup failed:', cleanupError);
      const { error: failedStateError } = await supabase
        .from('shows')
        .update({
          generation_status: 'failed',
          generation_error: 'Credit reservation failed before generation started.',
          generation_completed_at: new Date().toISOString(),
        })
        .eq('id', show.id)
        .eq('user_id', user.id);
      if (failedStateError) {
        console.error(
          '[createShowAction] failed to mark unreserved show as failed:',
          failedStateError,
        );
      }
    }
    return {
      ok: false,
      error: reservation.error ?? 'You do not have enough AI credits to generate this show.',
    };
  }

  await invalidateShowsCacheForUser(user.id);
  await invalidateShowCacheForUser(user.id, {
    showId: show.id,
    showSlug: show.slug,
  });
  revalidatePath('/home');
  revalidatePath(`/shows/${show.slug}`);
  revalidatePath(`/shows/${show.slug}/generating`);
  revalidatePath(`/shows/${show.slug}/preview`);

  after(async () => {
    const result = await generateCuesForShow({
      supabase,
      userId: user.id,
      showId: show.id,
      musicAnalysisId,
      selectedCueModel,
      generationMode,
    });
    if (!result.ok) {
      console.error('[createShowAction] background generation failed:', result.error);
    }
  });

  return { ok: true, slug: show.slug };
}
