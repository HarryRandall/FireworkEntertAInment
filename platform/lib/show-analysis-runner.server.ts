/**
 * Calls the hosted Modal song analyser (server-only).
 *
 * Pipeline:
 *   1. Mint a short-lived Supabase Storage signed URL for the audio.
 *   2. POST that URL + personality to the Modal endpoint with a bearer secret.
 *   3. Parse the analyser JSON, persist a `song_analyses` / `show_generation_runs`
 *      row, and let the caller render markdown.
 *
 * Failures are recorded on the analysis row (`status = 'failed'`,
 * `error_message`) so the UI can surface them; this function never throws
 * past the caller boundary for "expected" analyser failures.
 */
import 'server-only';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/database.types';
import type { AnalyserBuildup, AnalyserKeyMoment, AnalyserResult } from '@/lib/show-analysis.types';

const ANALYSER_SCHEMA_VERSION = '1.4.0';
const ANALYSER_RUNNER_VERSION = 'modal-librosa-2';
const SIGNED_URL_TTL_SECONDS = 600;

type AppSupabaseClient = SupabaseClient<Database>;

type ShowForAnalysis = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  budget_cents: number | null;
  time_of_day: string | null;
  location: string | null;
  mood_tags: string[] | null;
  audio_path: string | null;
};

type MusicAnalysisRow = {
  id: string;
  user_id: string;
  audio_path: string;
  personality: string;
};

export type RunShowAnalysisResult =
  | { ok: true; analysisId: string; contextMarkdown: string }
  | { ok: false; error: string; analysisId?: string; cancelled?: false }
  | { ok: false; error: string; analysisId: string; cancelled: true };

class AnalyseError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

function truncate(value: string, length = 1800): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length)}...`;
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function formatMoment(moment: AnalyserKeyMoment): string {
  const type = moment.type === 'climax' ? 'climax' : 'peak';
  return `- ${formatSeconds(moment.time)} (${moment.time}s): ${type}, energy ${moment.energy}, prominence ${moment.prominence}`;
}

function formatBuildup(buildup: AnalyserBuildup): string {
  return `- ${formatSeconds(buildup.start)}-${formatSeconds(buildup.peak)} (${buildup.duration}s): rise ${buildup.energy_rise}`;
}

function buildAiContextMarkdown(params: {
  show?: ShowForAnalysis | null;
  personality: string;
  analysis: AnalyserResult;
}): string {
  const { show, personality, analysis } = params;
  const musicProfile = analysis.music_profile;
  const showPersonality = analysis.show_personality;
  const keySignature = musicProfile?.key_signature;
  const climaxes = analysis.key_moments.filter((moment) => moment.type === 'climax');
  const peaks = analysis.key_moments.filter((moment) => moment.type !== 'climax');
  const traits = musicProfile?.dominant_traits?.join(', ') || 'unknown';
  const moodTags = show?.mood_tags?.length ? show.mood_tags.join(', ') : 'none';

  const lines = [
    '# AI Song Context',
    '',
    'Use this as the song context for generating a pyromusical show. It is intentionally analysis-only; choose fireworks separately from catalogue, budget, safety, and inventory constraints.',
    '',
  ];

  if (show) {
    lines.push(
      '## Show Brief',
      '',
      `- Title: ${show.title}`,
      `- Description: ${show.description || 'none'}`,
      `- Requested duration: ${show.duration_seconds ?? analysis.duration_seconds}s`,
      `- Budget: ${show.budget_cents != null ? `$${Math.round(show.budget_cents / 100)}` : 'not set'}`,
      `- Time of day: ${show.time_of_day || 'not set'}`,
      `- Location: ${show.location || 'not set'}`,
      `- Mood tags: ${moodTags}`,
      `- Personality preset: ${personality}`,
      '',
    );
  } else {
    lines.push('## Upload Context', '', `- Personality preset: ${personality}`, '');
  }

  lines.push(
    '## Song Summary',
    '',
    `- Duration: ${formatSeconds(analysis.duration_seconds)} (${analysis.duration_seconds}s)`,
    `- Tempo: ${analysis.tempo_bpm} BPM`,
    `- Total beats: ${analysis.total_beats}`,
    `- Genre hint: ${musicProfile?.genre_hint || 'unknown'}`,
    `- Key: ${keySignature?.root || 'unknown'} ${keySignature?.mode || ''}`.trim(),
    `- Dominant traits: ${traits}`,
    `- Density level: ${showPersonality?.density_level || 'unknown'}`,
    '',
    '## Style Direction',
    '',
    `- Music style vector: ${JSON.stringify(musicProfile?.style_vector ?? {})}`,
    `- Music descriptors: ${JSON.stringify(musicProfile?.descriptors ?? {})}`,
    `- Show personality dimensions: ${JSON.stringify(showPersonality?.dimensions ?? {})}`,
    `- Palette direction: ${JSON.stringify(showPersonality?.palette_direction ?? {})}`,
    '',
    '## Song Sections',
    '',
    '| # | Label | Time | Duration | Average energy | Peak energy | Intensity |',
    '| - | - | - | - | - | - | - |',
    ...analysis.sections.map((section, index) => {
      return `| ${index + 1} | ${section.label} | ${formatSeconds(section.start)}-${formatSeconds(section.end)} | ${section.duration}s | ${section.avg_energy} | ${section.peak_energy} | ${section.intensity} |`;
    }),
    '',
    '## Primary Musical Anchors',
    '',
    '### Climaxes',
    climaxes.length ? climaxes.map(formatMoment).join('\n') : '- None detected',
    '',
    '### Other Peaks',
    peaks.length ? peaks.map(formatMoment).join('\n') : '- None detected',
    '',
    '### Build-ups',
    analysis.buildups.length ? analysis.buildups.map(formatBuildup).join('\n') : '- None detected',
    '',
    '## Timing Reference',
    '',
    `- Beat sample: ${(analysis.beat_times ?? []).slice(0, 80).join(', ')}`,
    `- Onset sample: ${(analysis.onset_times ?? []).slice(0, 80).join(', ')}`,
    '',
  );

  return lines.join('\n');
}

async function runHostedAnalyser(params: {
  supabase: AppSupabaseClient;
  audioPath: string;
  personality: string;
  analysisId?: string;
}): Promise<AnalyserResult> {
  const analyserUrl = process.env.ANALYSER_URL;
  const analyserSecret = process.env.ANALYSER_SHARED_SECRET;
  if (!analyserUrl || !analyserSecret) {
    throw new AnalyseError(
      'Song analyser is not configured: set ANALYSER_URL and ANALYSER_SHARED_SECRET.',
      500,
    );
  }

  const { data: signed, error: signError } = await params.supabase.storage
    .from('audio')
    .createSignedUrl(params.audioPath, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed?.signedUrl) {
    throw new AnalyseError(
      signError?.message || 'Could not create a signed URL for the audio file.',
      400,
    );
  }

  let response: Response;
  try {
    response = await fetch(analyserUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${analyserSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysis_id: params.analysisId,
        audio_url: signed.signedUrl,
        personality: params.personality,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AnalyseError(`Could not reach the song analyser: ${message}`, 502);
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new AnalyseError(
      truncate(bodyText || `Analyser returned HTTP ${response.status}.`),
      response.status === 401 ? 500 : 422,
    );
  }

  try {
    return JSON.parse(bodyText) as AnalyserResult;
  } catch {
    throw new AnalyseError('The analyser did not return JSON output.', 422);
  }
}

async function markMusicAnalysisFailed(params: {
  supabase: AppSupabaseClient;
  analysisId: string;
  runtimeMs: number;
  errorMessage: string;
}): Promise<'updated' | 'missing' | 'error'> {
  const { data, error } = await params.supabase
    .from('song_analyses')
    .update({
      status: 'failed',
      runtime_ms: params.runtimeMs,
      error_message: truncate(params.errorMessage, 2000),
    })
    .eq('id', params.analysisId)
    .eq('status', 'running')
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[show-analysis-runner] failed to persist music failure state:', error);
    return 'error';
  }
  return data ? 'updated' : 'missing';
}

async function markShowAnalysisFailed(params: {
  supabase: AppSupabaseClient;
  analysisId: string;
  runtimeMs: number;
  errorMessage: string;
}) {
  const { error } = await params.supabase
    .from('show_generation_runs')
    .update({
      status: 'failed',
      runtime_ms: params.runtimeMs,
      error_message: truncate(params.errorMessage, 2000),
    })
    .eq('id', params.analysisId);
  if (error) {
    console.error('[show-analysis-runner] failed to persist show failure state:', error);
  }
}

export async function runMusicAnalysisForUpload(params: {
  supabase: AppSupabaseClient;
  userId: string;
  analysisId: string;
  personality?: 'balanced' | 'bold' | 'cinematic' | 'elegant' | 'intimate' | 'playful';
}): Promise<RunShowAnalysisResult> {
  const { data: row, error: lookupError } = await params.supabase
    .from('song_analyses')
    .select('id, user_id, audio_path, personality')
    .eq('id', params.analysisId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (lookupError) {
    console.error('[show-analysis-runner] music analysis lookup failed:', lookupError);
    return { ok: false, error: 'Could not load music analysis record.' };
  }
  if (!row) return { ok: false, error: 'Music analysis record not found.' };

  const typedRow = row as MusicAnalysisRow;
  const personality = params.personality ?? typedRow.personality ?? 'balanced';
  const startedAt = Date.now();

  const { data: claimed, error: claimError } = await params.supabase
    .from('song_analyses')
    .update({
      status: 'running',
      error_message: null,
      runner_version: ANALYSER_RUNNER_VERSION,
      schema_version: ANALYSER_SCHEMA_VERSION,
      personality,
    })
    .eq('id', typedRow.id)
    .eq('user_id', params.userId)
    .eq('status', 'running')
    .select('id')
    .maybeSingle();

  if (claimError) {
    console.error('[show-analysis-runner] music analysis claim failed:', claimError);
    return { ok: false, analysisId: typedRow.id, error: 'Could not start music analysis.' };
  }
  if (!claimed) {
    return {
      ok: false,
      analysisId: typedRow.id,
      cancelled: true,
      error: 'Music analysis was discarded.',
    };
  }

  try {
    const analysis = await runHostedAnalyser({
      supabase: params.supabase,
      audioPath: typedRow.audio_path,
      personality,
      analysisId: typedRow.id,
    });
    const contextMarkdown = buildAiContextMarkdown({
      personality,
      analysis,
    });
    const runtimeMs = Date.now() - startedAt;

    const { data: completed, error: updateError } = await params.supabase
      .from('song_analyses')
      .update({
        status: 'completed',
        schema_version: analysis.schema_version,
        completed_at: new Date().toISOString(),
        runtime_ms: runtimeMs,
        analysis_json: analysis as unknown as Json,
        markdown: contextMarkdown,
        error_message: null,
      })
      .eq('id', typedRow.id)
      .eq('user_id', params.userId)
      .eq('status', 'running')
      .select('id')
      .maybeSingle();
    if (updateError) {
      throw new AnalyseError(`Could not save analysis output: ${updateError.message}`, 500);
    }
    if (!completed) {
      return {
        ok: false,
        analysisId: typedRow.id,
        cancelled: true,
        error: 'Music analysis was discarded.',
      };
    }

    return { ok: true, analysisId: typedRow.id, contextMarkdown };
  } catch (error) {
    const runtimeMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    const failureState = await markMusicAnalysisFailed({
      supabase: params.supabase,
      analysisId: typedRow.id,
      runtimeMs,
      errorMessage: message,
    });
    if (failureState === 'missing') {
      return {
        ok: false,
        analysisId: typedRow.id,
        cancelled: true,
        error: 'Music analysis was discarded.',
      };
    }
    return { ok: false, analysisId: typedRow.id, error: message };
  }
}

export async function runShowAnalysisForShow(params: {
  supabase: AppSupabaseClient;
  userId: string;
  showId: string;
  personality?: 'balanced' | 'bold' | 'cinematic' | 'elegant' | 'intimate' | 'playful';
}): Promise<RunShowAnalysisResult> {
  const personality = params.personality ?? 'balanced';
  const { data: show, error: showError } = await params.supabase
    .from('shows')
    .select(
      'id, slug, title, description, duration_seconds, budget_cents, time_of_day, location, mood_tags, audio_path',
    )
    .eq('id', params.showId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (showError) {
    console.error('[show-analysis-runner] show lookup failed:', showError);
    return { ok: false, error: 'Could not load show for analysis.' };
  }
  if (!show) return { ok: false, error: 'Show not found.' };
  const typedShow = show as ShowForAnalysis;
  if (!typedShow.audio_path) {
    return { ok: false, error: 'This show has no uploaded audio to analyse.' };
  }

  const analysisId = randomUUID();
  const startedAt = Date.now();
  const { error: insertError } = await params.supabase.from('show_generation_runs').insert({
    id: analysisId,
    show_id: typedShow.id,
    user_id: params.userId,
    audio_path: typedShow.audio_path,
    personality,
    runner_version: ANALYSER_RUNNER_VERSION,
    schema_version: ANALYSER_SCHEMA_VERSION,
    status: 'running',
  });
  if (insertError) {
    console.error('[show-analysis-runner] analysis row insert failed:', insertError);
    return { ok: false, error: 'Could not create analysis record.' };
  }

  try {
    const analysis = await runHostedAnalyser({
      supabase: params.supabase,
      audioPath: typedShow.audio_path,
      personality,
      analysisId,
    });
    const contextMarkdown = buildAiContextMarkdown({
      show: typedShow,
      personality,
      analysis,
    });
    const runtimeMs = Date.now() - startedAt;

    const { error: updateError } = await params.supabase
      .from('show_generation_runs')
      .update({
        status: 'completed',
        schema_version: analysis.schema_version,
        completed_at: new Date().toISOString(),
        runtime_ms: runtimeMs,
        analysis_json: analysis as unknown as Json,
        llm_payload: null,
        markdown: contextMarkdown,
        error_message: null,
      })
      .eq('id', analysisId);
    if (updateError) {
      throw new AnalyseError(`Could not save analysis output: ${updateError.message}`, 500);
    }

    revalidatePath(`/shows/${typedShow.slug}`);
    return { ok: true, analysisId, contextMarkdown };
  } catch (error) {
    const runtimeMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    await markShowAnalysisFailed({
      supabase: params.supabase,
      analysisId,
      runtimeMs,
      errorMessage: message,
    });
    return { ok: false, analysisId, error: message };
  }
}
