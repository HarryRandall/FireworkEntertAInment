/**
 * Calls the hosted Modal song analyser (server-only).
 *
 * Pipeline:
 *   1. Claim a short database lease.
 *   2. Submit a durable Modal function call, or poll its opaque call ID.
 *   3. Parse completed output and persist the terminal state atomically.
 *
 * Upload-scoped runs use database leases. Only the worker holding the current
 * lease token can complete, retry, or fail an attempt, so a stale Modal call
 * cannot overwrite a recovered result.
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isRetryableAnalyserStatus } from '@/lib/analyser-http-status';
import { readResponseTextWithLimit, ResponseBodyTooLargeError } from '@/lib/bounded-response';
import type { Database, Json } from '@/lib/database.types';
import type { AnalyserBuildup, AnalyserKeyMoment, AnalyserResult } from '@/lib/show-analysis.types';
import {
  AnalyserOutputValidationError,
  parseAnalyserResult,
  type AnalyserV14Result,
} from '@/lib/show-analysis-validation';

const ANALYSER_RUNNER_VERSION = 'modal-librosa-3';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const ANALYSIS_LEASE_SECONDS = 60;
const ANALYSER_CONTROL_REQUEST_TIMEOUT_MS = 20 * 1000;
const ANALYSER_JOB_MAX_AGE_MS = 25 * 60 * 1000;
const ANALYSER_POLL_DELAY_SECONDS = 20;
const MAX_ANALYSER_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_ANALYSIS_ATTEMPTS = 3;
const RETRY_DELAYS_SECONDS = [30, 120] as const;

function analysisFailureCategory(error: unknown): string {
  if (!(error instanceof AnalyseError)) return 'internal';
  if (error.retryable) return error.status === 504 ? 'timeout' : 'upstream_transient';
  if (error.status === 422) return 'invalid_input_or_output';
  if (error.status === 401 || error.status === 403) return 'authentication';
  if (error.status >= 400 && error.status < 500) return 'terminal_request';
  return 'internal';
}

function logAnalysisLifecycle(fields: {
  analysisId: string;
  status: 'started' | 'submitted' | 'poll_pending' | 'completed' | 'retry_scheduled' | 'failed';
  attempt?: number;
  runtimeMs?: number;
  category?: string;
  retryDelaySeconds?: number;
}) {
  console.info('[music-analysis] lifecycle', fields);
}

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
  analysis_id: string;
  user_id: string;
  audio_path: string;
  personality: string;
  attempt_count: number;
  lease_token: string;
  analyser_job_id: string | null;
  analyser_job_submitted_at: string | null;
};

export type RunShowAnalysisResult =
  | { ok: true; analysisId: string; userId?: string; contextMarkdown: string }
  | {
      ok: false;
      error: string;
      analysisId?: string;
      userId?: string;
      cancelled?: boolean;
      pending?: boolean;
      submitted?: boolean;
      retryScheduled?: boolean;
      idle?: boolean;
    };

class AnalyseError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly retryable = false,
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

function analyserConfiguration(): { url: string; secret: string } {
  const analyserUrl = process.env.ANALYSER_URL;
  const analyserSecret = process.env.ANALYSER_SHARED_SECRET;
  if (!analyserUrl || !analyserSecret) {
    throw new AnalyseError(
      'Song analyser is not configured: set ANALYSER_URL and ANALYSER_SHARED_SECRET.',
      500,
    );
  }
  return { url: analyserUrl, secret: analyserSecret };
}

function analyserErrorFromBody(bodyText: string, status: number): AnalyseError {
  let message = bodyText || `Analyser returned HTTP ${status}.`;
  let retryable = isRetryableAnalyserStatus(status);
  try {
    const body = JSON.parse(bodyText) as {
      detail?: { message?: unknown; retryable?: unknown } | string;
    };
    if (typeof body.detail === 'string') message = body.detail;
    if (typeof body.detail === 'object' && body.detail != null) {
      if (typeof body.detail.message === 'string') message = body.detail.message;
      if (typeof body.detail.retryable === 'boolean') retryable = body.detail.retryable;
    }
  } catch {
    // Plain-text upstream failures retain the HTTP-derived classification.
  }
  return new AnalyseError(truncate(message), status, retryable);
}

async function postAnalyserControl(payload: Record<string, unknown>): Promise<{
  response: Response;
  bodyText: string;
}> {
  const analyser = analyserConfiguration();
  let response: Response;
  try {
    response = await fetch(analyser.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${analyser.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ANALYSER_CONTROL_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new AnalyseError(
      `Could not reach the song analyser: ${message}`,
      timedOut ? 504 : 502,
      true,
    );
  }

  let bodyText: string;
  try {
    bodyText = await readResponseTextWithLimit(response, MAX_ANALYSER_RESPONSE_BYTES);
  } catch (error) {
    if (error instanceof ResponseBodyTooLargeError) {
      throw new AnalyseError(
        `The analyser response exceeded ${MAX_ANALYSER_RESPONSE_BYTES} bytes.`,
        response.ok ? 422 : response.status,
        !response.ok && isRetryableAnalyserStatus(response.status),
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new AnalyseError(`Could not read the song analyser response: ${message}`, 502, true);
  }
  if (!response.ok && response.status !== 202) {
    throw analyserErrorFromBody(bodyText, response.status);
  }
  return { response, bodyText };
}

async function submitHostedAnalyser(params: {
  supabase: AppSupabaseClient;
  audioPath: string;
  personality: string;
  analysisId: string;
}): Promise<string> {
  analyserConfiguration();

  const { data: signed, error: signError } = await params.supabase.storage
    .from('audio')
    .createSignedUrl(params.audioPath, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed?.signedUrl) {
    throw new AnalyseError(
      signError?.message || 'Could not create a signed URL for the audio file.',
      400,
    );
  }

  const { response, bodyText } = await postAnalyserControl({
    action: 'submit',
    analysis_id: params.analysisId,
    audio_url: signed.signedUrl,
    personality: params.personality,
  });
  if (response.status !== 202) {
    throw new AnalyseError('The analyser did not acknowledge durable job submission.', 502, true);
  }
  try {
    const body = JSON.parse(bodyText) as { status?: unknown; job_id?: unknown };
    if (
      body.status !== 'submitted' ||
      typeof body.job_id !== 'string' ||
      !body.job_id ||
      body.job_id.length > 200
    ) {
      throw new Error('invalid submission envelope');
    }
    return body.job_id;
  } catch (error) {
    if (error instanceof AnalyseError) throw error;
    throw new AnalyseError('The analyser returned an invalid job submission envelope.', 502, true);
  }
}

async function pollHostedAnalyser(
  analyserJobId: string,
): Promise<{ status: 'running' } | { status: 'completed'; analysis: AnalyserV14Result }> {
  const { response, bodyText } = await postAnalyserControl({
    action: 'poll',
    job_id: analyserJobId,
  });
  if (response.status === 202) {
    return { status: 'running' };
  }

  try {
    const body = JSON.parse(bodyText) as { status?: unknown; result?: unknown };
    if (body.status !== 'completed') {
      throw new AnalyserOutputValidationError('The analyser returned an invalid poll envelope.');
    }
    return { status: 'completed', analysis: parseAnalyserResult(body.result) };
  } catch (error) {
    if (error instanceof AnalyserOutputValidationError) {
      throw new AnalyseError(error.message, 422);
    }
    throw new AnalyseError('The analyser returned an invalid poll response.', 422);
  }
}

async function classifyUnclaimedMusicAnalysis(params: {
  supabase: AppSupabaseClient;
  analysisId?: string;
  fallbackUserId?: string;
  error: string;
}): Promise<RunShowAnalysisResult> {
  if (!params.analysisId) {
    return { ok: false, pending: true, idle: true, error: params.error };
  }

  const { data: row, error: lookupError } = await params.supabase
    .from('song_analyses')
    .select('id, user_id, status, markdown, error_message')
    .eq('id', params.analysisId)
    .maybeSingle();
  if (lookupError) {
    console.error('[show-analysis-runner] music analysis state lookup failed:', lookupError);
    return {
      ok: false,
      analysisId: params.analysisId,
      userId: params.fallbackUserId,
      pending: true,
      error: params.error,
    };
  }
  if (!row) {
    return {
      ok: false,
      analysisId: params.analysisId,
      userId: params.fallbackUserId,
      cancelled: true,
      error: 'Music analysis was discarded.',
    };
  }
  if (row.status === 'completed' && row.markdown) {
    return {
      ok: true,
      analysisId: row.id,
      userId: row.user_id,
      contextMarkdown: row.markdown,
    };
  }
  if (row.status === 'failed') {
    return {
      ok: false,
      analysisId: row.id,
      userId: row.user_id,
      error: row.error_message || 'Music analysis failed.',
    };
  }
  return {
    ok: false,
    analysisId: row.id,
    userId: row.user_id,
    pending: true,
    error: params.error,
  };
}

export async function runMusicAnalysisForUpload(params: {
  supabase: AppSupabaseClient;
  userId?: string;
  analysisId?: string;
  personality?: 'balanced' | 'bold' | 'cinematic' | 'elegant' | 'intimate' | 'playful';
}): Promise<RunShowAnalysisResult> {
  const { data: claimedRows, error: claimError } = await params.supabase.rpc(
    'claim_song_analysis_attempt',
    {
      p_analysis_id: params.analysisId,
      p_lease_seconds: ANALYSIS_LEASE_SECONDS,
      p_max_attempts: MAX_ANALYSIS_ATTEMPTS,
    },
  );
  if (claimError) {
    console.error('[show-analysis-runner] music analysis claim failed:', claimError);
    return {
      ok: false,
      analysisId: params.analysisId,
      userId: params.userId,
      pending: true,
      error: 'Could not claim music analysis work.',
    };
  }

  const typedRow = (claimedRows?.[0] ?? null) as MusicAnalysisRow | null;
  if (!typedRow) {
    return classifyUnclaimedMusicAnalysis({
      supabase: params.supabase,
      analysisId: params.analysisId,
      fallbackUserId: params.userId,
      error: params.analysisId
        ? 'Music analysis is already claimed or waiting to retry.'
        : 'No song analysis is ready to reconcile.',
    });
  }
  if (params.userId && typedRow.user_id !== params.userId) {
    console.error('[show-analysis-runner] claimed music analysis owner did not match caller.');
    return {
      ok: false,
      analysisId: typedRow.analysis_id,
      userId: typedRow.user_id,
      pending: true,
      error: 'Could not claim music analysis work.',
    };
  }

  const personality = params.personality ?? typedRow.personality ?? 'balanced';
  const startedAt = Date.now();
  logAnalysisLifecycle({
    analysisId: typedRow.analysis_id,
    status: 'started',
    attempt: typedRow.attempt_count,
  });

  try {
    if (!typedRow.analyser_job_id) {
      const analyserJobId = await submitHostedAnalyser({
        supabase: params.supabase,
        audioPath: typedRow.audio_path,
        personality,
        analysisId: typedRow.analysis_id,
      });
      const { data: recorded, error: recordError } = await params.supabase.rpc(
        'record_song_analysis_job_submission',
        {
          p_analysis_id: typedRow.analysis_id,
          p_lease_token: typedRow.lease_token,
          p_analyser_job_id: analyserJobId,
          p_poll_delay_seconds: ANALYSER_POLL_DELAY_SECONDS,
        },
      );
      if (recordError || !recorded) {
        console.error('[show-analysis-runner] analyser job persistence failed:', recordError);
        return {
          ok: false,
          analysisId: typedRow.analysis_id,
          userId: typedRow.user_id,
          pending: true,
          error: 'The analyser job was submitted but its lease will need recovery.',
        };
      }
      logAnalysisLifecycle({
        analysisId: typedRow.analysis_id,
        status: 'submitted',
        attempt: typedRow.attempt_count,
        runtimeMs: Date.now() - startedAt,
      });
      return {
        ok: false,
        analysisId: typedRow.analysis_id,
        userId: typedRow.user_id,
        pending: true,
        submitted: true,
        error: 'Music analysis was submitted and is still running.',
      };
    }

    const submittedAt = typedRow.analyser_job_submitted_at
      ? Date.parse(typedRow.analyser_job_submitted_at)
      : Number.NaN;
    if (!Number.isFinite(submittedAt) || Date.now() - submittedAt > ANALYSER_JOB_MAX_AGE_MS) {
      throw new AnalyseError('The analyser job exceeded its 25-minute recovery window.', 504, true);
    }

    const polled = await pollHostedAnalyser(typedRow.analyser_job_id);
    if (polled.status === 'running') {
      const { data: deferred, error: deferError } = await params.supabase.rpc(
        'defer_song_analysis_job_poll',
        {
          p_analysis_id: typedRow.analysis_id,
          p_lease_token: typedRow.lease_token,
          p_analyser_job_id: typedRow.analyser_job_id,
          p_poll_delay_seconds: ANALYSER_POLL_DELAY_SECONDS,
        },
      );
      if (deferError || !deferred) {
        console.error('[show-analysis-runner] analyser poll deferral failed:', deferError);
        return {
          ok: false,
          analysisId: typedRow.analysis_id,
          userId: typedRow.user_id,
          pending: true,
          error: 'Music analysis is still running. The lease will be recovered.',
        };
      }
      logAnalysisLifecycle({
        analysisId: typedRow.analysis_id,
        status: 'poll_pending',
        attempt: typedRow.attempt_count,
        runtimeMs: Date.now() - startedAt,
      });
      return {
        ok: false,
        analysisId: typedRow.analysis_id,
        userId: typedRow.user_id,
        pending: true,
        error: 'Music analysis is still running.',
      };
    }

    const analysis = polled.analysis;
    const contextMarkdown = buildAiContextMarkdown({
      personality,
      analysis,
    });
    const runtimeMs = Math.max(
      0,
      Math.min(
        2_147_483_647,
        Math.round(analysis.analysis_meta.timings_ms.total_ms || Date.now() - startedAt),
      ),
    );

    const { data: completed, error: updateError } = await params.supabase.rpc(
      'complete_song_analysis_attempt',
      {
        p_analysis_id: typedRow.analysis_id,
        p_lease_token: typedRow.lease_token,
        p_analysis_json: analysis as unknown as Json,
        p_markdown: contextMarkdown,
        p_schema_version: analysis.schema_version,
        p_runner_version: ANALYSER_RUNNER_VERSION,
        p_runtime_ms: runtimeMs,
      },
    );
    if (updateError) {
      console.error('[show-analysis-runner] music analysis completion failed:', updateError);
      return {
        ok: false,
        analysisId: typedRow.analysis_id,
        userId: typedRow.user_id,
        pending: true,
        error: 'Could not save analysis output. The lease will be recovered.',
      };
    }
    if (!completed) {
      return classifyUnclaimedMusicAnalysis({
        supabase: params.supabase,
        analysisId: typedRow.analysis_id,
        fallbackUserId: typedRow.user_id,
        error: 'Music analysis completion lost its lease.',
      });
    }

    logAnalysisLifecycle({
      analysisId: typedRow.analysis_id,
      status: 'completed',
      attempt: typedRow.attempt_count,
      runtimeMs,
    });

    return {
      ok: true,
      analysisId: typedRow.analysis_id,
      userId: typedRow.user_id,
      contextMarkdown,
    };
  } catch (error) {
    const runtimeMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    const retryable = error instanceof AnalyseError && error.retryable;

    if (retryable && typedRow.attempt_count < MAX_ANALYSIS_ATTEMPTS) {
      const retryDelay =
        RETRY_DELAYS_SECONDS[
          Math.min(typedRow.attempt_count - 1, RETRY_DELAYS_SECONDS.length - 1)
        ] ?? RETRY_DELAYS_SECONDS[RETRY_DELAYS_SECONDS.length - 1];
      const { data: scheduled, error: retryError } = await params.supabase.rpc(
        'schedule_song_analysis_retry',
        {
          p_analysis_id: typedRow.analysis_id,
          p_lease_token: typedRow.lease_token,
          p_error_message: truncate(message, 2000),
          p_runtime_ms: runtimeMs,
          p_retry_delay_seconds: retryDelay,
        },
      );
      if (retryError) {
        console.error('[show-analysis-runner] music analysis retry scheduling failed:', retryError);
        return {
          ok: false,
          analysisId: typedRow.analysis_id,
          userId: typedRow.user_id,
          pending: true,
          error: `${message} The lease will be recovered.`,
        };
      }
      if (!scheduled) {
        return classifyUnclaimedMusicAnalysis({
          supabase: params.supabase,
          analysisId: typedRow.analysis_id,
          fallbackUserId: typedRow.user_id,
          error: 'Music analysis retry lost its lease.',
        });
      }
      logAnalysisLifecycle({
        analysisId: typedRow.analysis_id,
        status: 'retry_scheduled',
        attempt: typedRow.attempt_count,
        runtimeMs,
        category: analysisFailureCategory(error),
        retryDelaySeconds: retryDelay,
      });
      return {
        ok: false,
        analysisId: typedRow.analysis_id,
        userId: typedRow.user_id,
        pending: true,
        retryScheduled: true,
        error: message,
      };
    }

    const { data: failed, error: failureError } = await params.supabase.rpc(
      'fail_song_analysis_attempt',
      {
        p_analysis_id: typedRow.analysis_id,
        p_lease_token: typedRow.lease_token,
        p_error_message: truncate(message, 2000),
        p_runtime_ms: runtimeMs,
      },
    );
    if (failureError) {
      console.error(
        '[show-analysis-runner] music analysis failure persistence failed:',
        failureError,
      );
      return {
        ok: false,
        analysisId: typedRow.analysis_id,
        userId: typedRow.user_id,
        pending: true,
        error: `${message} The lease will be recovered.`,
      };
    }
    if (!failed) {
      return classifyUnclaimedMusicAnalysis({
        supabase: params.supabase,
        analysisId: typedRow.analysis_id,
        fallbackUserId: typedRow.user_id,
        error: 'Music analysis failure lost its lease.',
      });
    }
    logAnalysisLifecycle({
      analysisId: typedRow.analysis_id,
      status: 'failed',
      attempt: typedRow.attempt_count,
      runtimeMs,
      category: analysisFailureCategory(error),
    });
    return {
      ok: false,
      analysisId: typedRow.analysis_id,
      userId: typedRow.user_id,
      error: message,
    };
  }
}

export async function runShowAnalysisForShow(params: {
  supabase: AppSupabaseClient;
  userId: string;
  showId: string;
  personality?: 'balanced' | 'bold' | 'cinematic' | 'elegant' | 'intimate' | 'playful';
}): Promise<RunShowAnalysisResult> {
  const { data: show, error: showError } = await params.supabase
    .from('shows')
    .select('music_analysis_id')
    .eq('id', params.showId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (showError) {
    console.error('[show-analysis-runner] show lookup failed:', showError);
    return { ok: false, error: 'Could not load show for analysis.' };
  }
  if (!show) return { ok: false, error: 'Show not found.' };
  if (!show.music_analysis_id) {
    return { ok: false, error: 'This show has no upload-scoped music analysis.' };
  }

  return runMusicAnalysisForUpload({
    supabase: params.supabase,
    userId: params.userId,
    analysisId: show.music_analysis_id,
    personality: params.personality,
  });
}
