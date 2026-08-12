/** Music-analysis API endpoint exposing analyser status/results for a track. */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { startMusicAnalysisForStoredAudio } from '@/lib/start-music-analysis.server';

export const maxDuration = 60;

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

  const result = await startMusicAnalysisForStoredAudio({
    supabase,
    userId: user.id,
    audioPath: parsed.data.audioPath,
    contentType: storedAudio.contentType,
    originalFilename: parsed.data.originalFilename ?? null,
    sizeBytes: storedAudio.sizeBytes,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
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
