/** Music-analysis API endpoint exposing analyser status/results for a track. */

import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { runMusicAnalysisForUpload } from '@/lib/show-analysis-runner.server';

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
  contentType: z.string().trim().max(120).optional(),
  sizeBytes: z.coerce.number().int().min(1).max(MAX_AUDIO_BYTES).optional(),
});

function isUserAudioPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes('..');
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
  if (parsed.data.contentType && !ALLOWED_AUDIO_TYPES.has(parsed.data.contentType)) {
    return NextResponse.json(
      { ok: false, error: 'Unsupported audio format. Use MP3, WAV, AAC, or M4A.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('music_analyses')
    .insert({
      user_id: user.id,
      audio_path: parsed.data.audioPath,
      original_filename: parsed.data.originalFilename || null,
      content_type: parsed.data.contentType || null,
      size_bytes: parsed.data.sizeBytes ?? null,
      personality: 'balanced',
      status: 'running',
      runner_version: 'modal-librosa-2',
      schema_version: '1.3.0',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[api/music-analysis] insert failed:', error);
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
    }
  });

  return NextResponse.json({ ok: true, musicAnalysisId: data.id });
}
