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
    .select('id')
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

  for (const show of shows ?? []) {
    const result = await generateCuesForShow({
      supabase: params.supabase,
      userId: params.userId,
      showId: show.id,
      musicAnalysisId: params.musicAnalysisId,
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
