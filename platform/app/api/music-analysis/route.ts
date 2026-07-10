/** Music-analysis API endpoint exposing analyser status/results for a track. */

import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { runMusicAnalysisForUpload } from '@/lib/show-analysis-runner.server';
import { generateCuesForShow } from '@/lib/cue-generation.server';
import { markGenerationStatus } from '@/lib/cue-generation/loaders.server';
import {
  musicAnalysisReservationKey,
  refundAiCreditReservation,
  reserveAiCredits,
  settleAiCreditReservation,
  showGenerationReservationKey,
} from '@/lib/ai-credits.server';

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
]);

const BodySchema = z.object({
  audioPath: z.string().trim().min(1).max(300),
  originalFilename: z.string().trim().max(180).optional(),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.coerce.number().int().min(1).max(MAX_AUDIO_BYTES),
});

const DeleteBodySchema = z.object({
  musicAnalysisId: z.string().uuid(),
  audioPath: z.string().trim().min(1).max(300),
});

type DiscardAnalysisResult = {
  ok: boolean;
  code?: string;
  audioPath?: string;
};

function parseDiscardAnalysisResult(value: unknown): DiscardAnalysisResult | null {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return null;
  const ok = value.ok;
  if (typeof ok !== 'boolean') return null;
  return {
    ok,
    code: 'code' in value && typeof value.code === 'string' ? value.code : undefined,
    audioPath:
      'audioPath' in value && typeof value.audioPath === 'string' ? value.audioPath : undefined,
  };
}

function isUserAudioPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes('..');
}

type AppSupabaseClient = ReturnType<typeof createClient>;
type AudioObjectMetadata = {
  contentType: string;
  sizeBytes: number;
};

async function getUploadedAudioMetadata(params: {
  supabase: AppSupabaseClient;
  audioPath: string;
  userId: string;
}): Promise<AudioObjectMetadata | null> {
  const fileName = params.audioPath.slice(params.userId.length + 1);
  if (!fileName || fileName.includes('/')) return null;

  const { data, error } = await params.supabase.storage.from('audio').list(params.userId, {
    limit: 100,
    search: fileName,
  });
  if (error) {
    console.error('[api/music-analysis] storage metadata lookup failed:', error);
    return null;
  }

  const object = (data ?? []).find((item) => item.name === fileName);
  const metadata = object?.metadata as Record<string, unknown> | undefined;
  const sizeBytes =
    typeof metadata?.size === 'number'
      ? metadata.size
      : typeof metadata?.size === 'string'
        ? Number(metadata.size)
        : NaN;
  const contentType =
    typeof metadata?.mimetype === 'string'
      ? metadata.mimetype
      : typeof metadata?.contentType === 'string'
        ? metadata.contentType
        : '';

  if (!object || !Number.isFinite(sizeBytes) || !contentType) return null;
  return { contentType, sizeBytes };
}

async function listRunningShowsForAnalysis(params: {
  supabase: AppSupabaseClient;
  userId: string;
  musicAnalysisId: string;
}) {
  const { data: shows, error } = await params.supabase
    .from('shows')
    .select('id, selected_cue_model, show_style')
    .eq('user_id', params.userId)
    .eq('music_analysis_id', params.musicAnalysisId)
    .eq('generation_status', 'running')
    .is('generation_completed_at', null);

  if (error) {
    console.error('[api/music-analysis] linked show lookup failed:', error);
    return [];
  }

  return shows ?? [];
}

async function resumeCueGenerationForCompletedAnalysis(params: {
  supabase: AppSupabaseClient;
  userId: string;
  musicAnalysisId: string;
}) {
  const shows = await listRunningShowsForAnalysis(params);
  const showIds = shows.map((show) => show.id);
  const { data: reservations, error: reservationsError } = showIds.length
    ? await params.supabase
        .from('ai_credit_transactions')
        .select('reference_id, action_key, created_at')
        .eq('user_id', params.userId)
        .eq('reference_type', 'shows')
        .eq('transaction_type', 'reserve')
        .in('reference_id', showIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null };
  if (reservationsError) {
    console.error('[api/music-analysis] generation reservation lookup failed:', reservationsError);
  }
  const actionByShowId = new Map<string, string>();
  for (const reservation of reservations ?? []) {
    if (reservation.reference_id && !actionByShowId.has(reservation.reference_id)) {
      actionByShowId.set(reservation.reference_id, reservation.action_key);
    }
  }

  for (const show of shows ?? []) {
    const reservationAction = actionByShowId.get(show.id);
    const result = await generateCuesForShow({
      supabase: params.supabase,
      userId: params.userId,
      showId: show.id,
      musicAnalysisId: params.musicAnalysisId,
      selectedCueModel: show.selected_cue_model,
      generationMode:
        show.show_style === 'beat_test'
          ? 'beat'
          : reservationAction === 'show_generation_fast'
            ? 'fast'
            : show.selected_cue_model
              ? 'llm'
              : 'fast',
    });
    if (!result.ok) {
      console.error('[api/music-analysis] resumed cue generation failed:', result.error);
    }
  }
}

async function markLinkedShowGenerationFailed(params: {
  supabase: AppSupabaseClient;
  userId: string;
  musicAnalysisId: string;
  error: string;
}) {
  const shows = await listRunningShowsForAnalysis(params);
  const message = `Music analysis failed: ${params.error}`;

  for (const show of shows) {
    await markGenerationStatus(params.supabase, params.userId, show.id, {
      generation_status: 'failed',
      generation_error: message,
      generation_completed_at: new Date().toISOString(),
    });
    await refundAiCreditReservation(params.supabase, {
      userId: params.userId,
      reservationKey: showGenerationReservationKey(show.id),
      metadata: { reason: message },
    });
  }
}

export async function POST(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { ok: false, error: 'You must be signed in to upload music.' },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Uploaded audio details are invalid.' },
      { status: 400 },
    );
  }
  if (!isUserAudioPath(parsed.data.audioPath, user.id)) {
    return NextResponse.json(
      { ok: false, error: 'Uploaded audio path is invalid.' },
      { status: 400 },
    );
  }
  if (!ALLOWED_AUDIO_TYPES.has(parsed.data.contentType)) {
    return NextResponse.json(
      { ok: false, error: 'Unsupported audio format. Use MP3, WAV, AAC, or M4A.' },
      { status: 400 },
    );
  }
  const storedAudio = await getUploadedAudioMetadata({
    supabase,
    userId: user.id,
    audioPath: parsed.data.audioPath,
  });
  if (!storedAudio) {
    return NextResponse.json(
      { ok: false, error: 'Uploaded audio file was not found.' },
      { status: 400 },
    );
  }
  if (storedAudio.sizeBytes > MAX_AUDIO_BYTES || parsed.data.sizeBytes > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'Audio must be 50MB or smaller.' },
      { status: 400 },
    );
  }
  if (!ALLOWED_AUDIO_TYPES.has(storedAudio.contentType)) {
    return NextResponse.json(
      { ok: false, error: 'Unsupported audio format. Use MP3, WAV, AAC, or M4A.' },
      { status: 400 },
    );
  }

  const analysisId = crypto.randomUUID();
  const reservationKey = musicAnalysisReservationKey(analysisId);
  const reservation = await reserveAiCredits(supabase, {
    userId: user.id,
    actionKey: 'music_analysis',
    referenceType: 'song_analyses',
    referenceId: analysisId,
    reservationKey,
    metadata: {
      audioPath: parsed.data.audioPath,
      contentType: storedAudio.contentType,
      originalFilename: parsed.data.originalFilename ?? null,
      sizeBytes: storedAudio.sizeBytes,
    },
  });

  if (!reservation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: reservation.error ?? 'You do not have enough AI credits to analyse this track.',
      },
      { status: 402 },
    );
  }

  const { data, error } = await supabase
    .from('song_analyses')
    .insert({
      id: analysisId,
      user_id: user.id,
      audio_path: parsed.data.audioPath,
      original_filename: parsed.data.originalFilename || null,
      content_type: storedAudio.contentType,
      size_bytes: storedAudio.sizeBytes,
      personality: 'balanced',
      status: 'running',
      runner_version: 'modal-librosa-2',
      schema_version: '1.4.0',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[api/music-analysis] insert failed:', error);
    await refundAiCreditReservation(supabase, {
      userId: user.id,
      reservationKey,
      metadata: { reason: 'Could not prepare music analysis.' },
    });
    return NextResponse.json(
      { ok: false, error: 'Could not prepare music analysis.' },
      { status: 500 },
    );
  }

  after(async () => {
    const result = await runMusicAnalysisForUpload({
      supabase,
      userId: user.id,
      analysisId: data.id,
      personality: 'balanced',
    });
    if (!result.ok) {
      if (result.cancelled) {
        await refundAiCreditReservation(supabase, {
          userId: user.id,
          reservationKey,
          metadata: { reason: 'Unused music analysis discarded.' },
        });
        return;
      }
      console.error('[api/music-analysis] background analysis failed:', result.error);
      await refundAiCreditReservation(supabase, {
        userId: user.id,
        reservationKey,
        metadata: { reason: result.error },
      });
      await markLinkedShowGenerationFailed({
        supabase,
        userId: user.id,
        musicAnalysisId: data.id,
        error: result.error,
      });
      return;
    }
    await settleAiCreditReservation(supabase, {
      userId: user.id,
      reservationKey,
      metadata: { runner: 'modal-librosa-2' },
    });
    await resumeCueGenerationForCompletedAnalysis({
      supabase,
      userId: user.id,
      musicAnalysisId: data.id,
    });
  });

  return NextResponse.json({ ok: true, musicAnalysisId: data.id });
}

export async function DELETE(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { ok: false, error: 'You must be signed in to remove uploaded music.' },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = DeleteBodySchema.safeParse(json);
  if (!parsed.success || !isUserAudioPath(parsed.data.audioPath, user.id)) {
    return NextResponse.json(
      { ok: false, error: 'Uploaded audio details are invalid.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc('discard_unused_song_analysis', {
    p_analysis_id: parsed.data.musicAnalysisId,
    p_audio_path: parsed.data.audioPath,
  });
  if (error) {
    console.error('[api/music-analysis] discard failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not remove the unused track.' },
      { status: 500 },
    );
  }

  const result = parseDiscardAnalysisResult(data);
  if (!result?.ok) {
    if (result?.code === 'in_use') {
      return NextResponse.json(
        { ok: false, error: 'This track is already attached to a show.' },
        { status: 409 },
      );
    }
    if (result?.code === 'credit_race') {
      return NextResponse.json(
        { ok: false, error: 'The track is still finishing. Try again.' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'Uploaded audio details are invalid.' },
      { status: result?.code === 'not_permitted' ? 403 : 400 },
    );
  }

  const audioPath = result.audioPath ?? parsed.data.audioPath;
  if (!isUserAudioPath(audioPath, user.id) || audioPath !== parsed.data.audioPath) {
    console.error('[api/music-analysis] discard returned an unexpected audio path.');
    return NextResponse.json(
      { ok: false, error: 'Could not remove the unused track.' },
      { status: 500 },
    );
  }

  const { error: storageError } = await supabase.storage.from('audio').remove([audioPath]);
  if (storageError) {
    console.error('[api/music-analysis] audio cleanup failed:', storageError);
    return NextResponse.json(
      { ok: false, error: 'Could not remove the unused track.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
