/**
 * Shared request-bound music-analysis preparation.
 *
 * User uploads and provider imports both arrive here only after their private
 * Storage object and ownership have been established. Credit reservation, the
 * analysis row, and a short Modal submission therefore follow one lifecycle.
 * Completion is polled through the durable reconciliation path.
 */
import 'server-only';

import { after } from 'next/server';
import {
  musicAnalysisReservationKey,
  refundAiCreditReservation,
  reserveAiCredits,
} from '@/lib/ai-credits.server';
import { markLinkedShowGenerationFailed } from '@/lib/music-analysis-lifecycle.server';
import { runMusicAnalysisForUpload } from '@/lib/show-analysis-runner.server';
import type { SoundtrackAttribution } from '@/lib/music-library.types';
import { createClient } from '@/utils/supabase/server';

type AppSupabaseClient = ReturnType<typeof createClient>;

export type StartMusicAnalysisResult =
  | { ok: true; musicAnalysisId: string }
  | { ok: false; error: string; status: 402 | 500 };

export async function startMusicAnalysisForStoredAudio(params: {
  supabase: AppSupabaseClient;
  userId: string;
  audioPath: string;
  originalFilename: string | null;
  contentType: string;
  sizeBytes: number;
  source?: SoundtrackAttribution;
}): Promise<StartMusicAnalysisResult> {
  const analysisId = crypto.randomUUID();
  const reservationKey = musicAnalysisReservationKey(analysisId);
  const reservation = await reserveAiCredits(params.supabase, {
    userId: params.userId,
    actionKey: 'music_analysis',
    referenceType: 'song_analyses',
    referenceId: analysisId,
    reservationKey,
    metadata: {
      audioPath: params.audioPath,
      contentType: params.contentType,
      originalFilename: params.originalFilename,
      sizeBytes: params.sizeBytes,
      sourceProvider: params.source?.provider ?? null,
      sourceTrackId: params.source?.trackId ?? null,
    },
  });

  if (!reservation.ok) {
    return {
      ok: false,
      error: reservation.error ?? 'You do not have enough AI credits to analyse this track.',
      status: 402,
    };
  }

  const { data, error } = await params.supabase
    .from('song_analyses')
    .insert({
      id: analysisId,
      user_id: params.userId,
      audio_path: params.audioPath,
      original_filename: params.originalFilename,
      content_type: params.contentType,
      size_bytes: params.sizeBytes,
      personality: 'balanced',
      status: 'running',
      runner_version: 'modal-librosa-3',
      schema_version: '1.4.0',
      source_provider: params.source?.provider ?? null,
      source_track_id: params.source?.trackId ?? null,
      source_title: params.source?.title ?? null,
      source_artist: params.source?.artist ?? null,
      source_url: params.source?.sourceUrl ?? null,
      source_licence_name: params.source?.licenceName ?? null,
      source_licence_url: params.source?.licenceUrl ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[music-analysis] insert failed:', error);
    await refundAiCreditReservation(params.supabase, {
      userId: params.userId,
      reservationKey,
      metadata: { reason: 'Could not prepare music analysis.' },
    });
    return { ok: false, error: 'Could not prepare music analysis.', status: 500 };
  }

  after(async () => {
    const result = await runMusicAnalysisForUpload({
      supabase: params.supabase,
      userId: params.userId,
      analysisId: data.id,
      personality: 'balanced',
    });
    if (!result.ok) {
      if (result.pending) return;
      if (result.cancelled) return;
      console.error('[music-analysis] background analysis failed:', result.error);
      await markLinkedShowGenerationFailed({
        supabase: params.supabase,
        userId: params.userId,
        musicAnalysisId: data.id,
        error: result.error,
      });
    }
  });

  return { ok: true, musicAnalysisId: data.id };
}
