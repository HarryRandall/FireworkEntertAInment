/**
 * Read-side server helpers for the music/show analysis snapshots.
 *
 * The analyser is a Python (librosa) job that produces beat/section/key-moment
 * data for an uploaded track. Two related rows hold the result:
 *
 * - `song_analyses` — analyser output keyed by audio file (newer schema).
 * - `show_generation_runs` — legacy per-show row, still read for old shows.
 *
 * This module exposes a unified {@link ShowAnalysisSnapshot} so callers
 * don't have to know which table their analysis lives in.
 */
import 'server-only';

import { getCurrentUserId } from '@/lib/current-user.server';
import { getServerClient } from '@/utils/supabase/server-client';
import type { Database } from '@/lib/database.types';
import type {
  AnalyserResult,
  AnalysisStatus,
  CueGenerationStatus,
  ShowAnalysisSnapshot,
} from '@/lib/show-analysis.types';

type MusicAnalysisRow = Database['public']['Tables']['song_analyses']['Row'];
type ShowAnalysisRow = Database['public']['Tables']['show_generation_runs']['Row'];

const MUSIC_ANALYSIS_SELECT =
  'id, status, schema_version, personality, audio_path, runner_version, runtime_ms, error_message, created_at, completed_at, markdown, analysis_json';
const LEGACY_SHOW_ANALYSIS_SELECT =
  'id, show_id, status, schema_version, personality, audio_path, runner_version, runtime_ms, error_message, created_at, completed_at, markdown, analysis_json, cue_generation_status, cue_generation_error, cue_count';

function failAnalysisRead(operation: string, error: unknown): never {
  console.error(`[show-analyses.server] ${operation} failed:`, error);
  throw new Error('Show analysis could not be loaded.', { cause: error });
}

function hydrateMusicAnalysis(
  row: MusicAnalysisRow,
  showId: string,
  cueGenerationStatus: CueGenerationStatus,
  cueGenerationError: string | null,
  cueCount: number | null,
): ShowAnalysisSnapshot {
  return {
    id: row.id,
    showId,
    status: row.status as AnalysisStatus,
    schemaVersion: row.schema_version,
    personality: row.personality,
    audioPath: row.audio_path,
    runnerVersion: row.runner_version,
    runtimeMs: row.runtime_ms,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    contextMarkdown: row.markdown,
    analysis: row.analysis_json as unknown as AnalyserResult | null,
    cueGenerationStatus,
    cueGenerationError,
    cueCount,
  };
}

function hydrateLegacyShowAnalysis(row: ShowAnalysisRow): ShowAnalysisSnapshot {
  return {
    id: row.id,
    showId: row.show_id,
    status: row.status as AnalysisStatus,
    schemaVersion: row.schema_version,
    personality: row.personality,
    audioPath: row.audio_path,
    runnerVersion: row.runner_version,
    runtimeMs: row.runtime_ms,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    contextMarkdown: row.markdown,
    analysis: row.analysis_json as unknown as AnalyserResult | null,
    cueGenerationStatus: (row.cue_generation_status as CueGenerationStatus) ?? 'pending',
    cueGenerationError: row.cue_generation_error,
    cueCount: row.cue_count,
  };
}

/**
 * Lightweight status-only lookup for the generating splash, so the progress
 * UI can distinguish "still analysing the track" from "generating cues"
 * without pulling the full analysis payload on every poll.
 */
export async function getMusicAnalysisStatus(
  musicAnalysisId: string,
): Promise<AnalysisStatus | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('song_analyses')
    .select('status')
    .eq('id', musicAnalysisId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    failAnalysisRead('status lookup', error);
  }
  return (data?.status as AnalysisStatus) ?? null;
}

export async function getLatestAnalysisForShow(
  showId: string,
): Promise<ShowAnalysisSnapshot | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await getServerClient();
  const { data: show, error: showError } = await supabase
    .from('shows')
    .select('id, music_analysis_id, generation_status, generation_error, generated_cue_count')
    .eq('id', showId)
    .eq('user_id', userId)
    .maybeSingle();

  if (showError) {
    failAnalysisRead('show lookup', showError);
  }

  if (show?.music_analysis_id) {
    const { data, error } = await supabase
      .from('song_analyses')
      .select(MUSIC_ANALYSIS_SELECT)
      .eq('id', show.music_analysis_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      failAnalysisRead('music analysis lookup', error);
    }
    if (data) {
      const generationStatus =
        show.generation_status === 'running'
          ? 'running'
          : show.generation_status === 'completed'
            ? 'completed'
            : show.generation_status === 'failed'
              ? 'failed'
              : 'pending';
      return hydrateMusicAnalysis(
        data as MusicAnalysisRow,
        showId,
        generationStatus,
        show.generation_error,
        show.generated_cue_count,
      );
    }
  }

  const { data, error } = await supabase
    .from('show_generation_runs')
    .select(LEGACY_SHOW_ANALYSIS_SELECT)
    .eq('show_id', showId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    failAnalysisRead('legacy analysis lookup', error);
  }
  return data ? hydrateLegacyShowAnalysis(data as ShowAnalysisRow) : null;
}
