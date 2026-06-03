'use server';

/** Server actions powering the new-show wizard: kicking off the audio analyser and creating the show row. */

import { cookies } from 'next/headers';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { slugifyTitle } from '@/lib/show-domain';
import { invalidateShowCacheForUser, invalidateShowsCacheForUser } from '@/lib/shows.server';
import { generateCuesForShow } from '@/lib/cue-generation.server';

const DURATION_TO_SECONDS: Record<string, number> = {
  '1 minute': 60,
  '2 minutes': 120,
  '3 minutes': 180,
  '5 minutes': 300,
  '10 minutes': 600,
};

function parseDurationSeconds(duration: string) {
  if (DURATION_TO_SECONDS[duration] != null) return DURATION_TO_SECONDS[duration];

  const match = duration.trim().match(/^(\d+)\s+minutes?$/i);
  if (!match) return null;

  const minutes = Number(match[1]);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) return null;
  return minutes * 60;
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
  audioPath: z.string().trim().max(300).optional(),
  musicAnalysisId: z.string().uuid().optional(),
  desiredSlug: z.string().trim().max(120).optional(),
});

export type NewShowResult = { ok: true; slug: string } | { ok: false; error: string };

function isUserAudioPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes('..');
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
    audioPath: formData.get('audioPath') ?? undefined,
    musicAnalysisId: formData.get('musicAnalysisId') ?? undefined,
    desiredSlug: formData.get('desiredSlug') ?? undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? 'Please fill out all required fields.',
    };
  }

  let audioPath = parsed.data.audioPath || null;
  const musicAnalysisId = parsed.data.musicAnalysisId || null;

  if (musicAnalysisId) {
    const { data: analysis, error: analysisError } = await supabase
      .from('music_analyses')
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
      audio_path: audioPath,
      music_analysis_id: musicAnalysisId,
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

  await invalidateShowsCacheForUser(user.id);
  await invalidateShowCacheForUser(user.id, {
    showId: show.id,
    showSlug: show.slug,
  });
  revalidatePath('/dashboard');
  revalidatePath(`/shows/${show.slug}`);
  revalidatePath(`/shows/${show.slug}/generating`);
  revalidatePath(`/shows/${show.slug}/preview`);

  after(async () => {
    const result = await generateCuesForShow({
      supabase,
      userId: user.id,
      showId: show.id,
      musicAnalysisId,
    });
    if (!result.ok) {
      console.error('[createShowAction] background generation failed:', result.error);
    }
  });

  return { ok: true, slug: show.slug };
}
