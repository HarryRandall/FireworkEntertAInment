/** Cron-safe recovery for analysis, cue generation, credits, and private audio. */

import { NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import { runMusicAnalysisForUpload } from '@/lib/show-analysis-runner.server';
import { generateCuesForShow } from '@/lib/cue-generation.server';
import { markLinkedShowGenerationFailed } from '@/lib/music-analysis-lifecycle.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const EXPIRED_BATCH_SIZE = 10;
const CREDIT_REPAIR_BATCH_SIZE = 10;
const AUDIO_RETENTION_BATCH_SIZE = 25;
const AUDIO_RETENTION_DAYS = 7;
const AUDIO_ORPHAN_GRACE_HOURS = 24;

function isAuthorised(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return process.env.NODE_ENV === 'development';
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }

  const supabase = createServiceRoleSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Backend lifecycle reconciliation is not configured.' },
      { status: 503 },
    );
  }

  const errors: string[] = [];
  let expiredAnalysisCount = 0;
  let expiredCueCount = 0;
  let analysisClaimedCount = 0;
  let analysisCompletedCount = 0;
  let analysisRetryScheduledCount = 0;
  let analysisTerminalFailureCount = 0;
  let cueClaimedCount = 0;
  let cueCompletedCount = 0;
  let cueRetryScheduledCount = 0;
  let cueTerminalFailureCount = 0;
  let purgedAnalysisCount = 0;
  let removedAudioCount = 0;
  let repairedShowCredits = 0;

  const [analysisExpiry, cueExpiry] = await Promise.all([
    supabase.rpc('expire_exhausted_song_analyses', {
      p_limit: EXPIRED_BATCH_SIZE,
      p_max_attempts: 3,
    }),
    supabase.rpc('expire_exhausted_cue_generations', {
      p_limit: EXPIRED_BATCH_SIZE,
      p_max_attempts: 3,
    }),
  ]);
  if (analysisExpiry.error) {
    errors.push(`Could not expire exhausted analyses: ${analysisExpiry.error.message}`);
  } else {
    expiredAnalysisCount = analysisExpiry.data?.length ?? 0;
  }
  if (cueExpiry.error) {
    errors.push(`Could not expire exhausted cue generation: ${cueExpiry.error.message}`);
  } else {
    expiredCueCount = cueExpiry.data?.length ?? 0;
  }

  // Delete the unreferenced database rows first. The foreign key lock prevents
  // a show from attaching the analysis while retention is claiming it.
  const [retainedAnalyses, orphanObjects] = await Promise.all([
    supabase.rpc('purge_expired_song_analyses', {
      p_limit: AUDIO_RETENTION_BATCH_SIZE,
      p_retention_days: AUDIO_RETENTION_DAYS,
    }),
    supabase.rpc('list_orphan_audio_objects', {
      p_limit: AUDIO_RETENTION_BATCH_SIZE,
      p_grace_hours: AUDIO_ORPHAN_GRACE_HOURS,
    }),
  ]);
  if (retainedAnalyses.error) {
    errors.push(`Could not purge retained song analyses: ${retainedAnalyses.error.message}`);
  } else {
    purgedAnalysisCount = retainedAnalyses.data?.length ?? 0;
  }
  if (orphanObjects.error) {
    errors.push(`Could not inspect orphan audio: ${orphanObjects.error.message}`);
  }

  const retainedOwnerByPath = new Map(
    (retainedAnalyses.data ?? []).flatMap((analysis) =>
      analysis.audio_path ? [[analysis.audio_path, analysis.user_id] as const] : [],
    ),
  );
  const audioPaths = [
    ...new Set(
      [
        ...(retainedAnalyses.data ?? []).map((analysis) => analysis.audio_path),
        ...(orphanObjects.data ?? []).map((object) => object.audio_path),
      ].filter((audioPath): audioPath is string => Boolean(audioPath)),
    ),
  ];
  if (audioPaths.length) {
    const { error: removeError } = await supabase.storage.from('audio').remove(audioPaths);
    if (removeError) {
      errors.push(`Could not remove retained audio: ${removeError.message}`);
      for (const audioPath of audioPaths) {
        const { error: deadLetterError } = await supabase.rpc('record_backend_dead_letter', {
          p_work_type: 'audio_cleanup',
          p_work_key: audioPath,
          // Orphan objects have no retained analysis owner; the column is
          // nullable but the generated arg type is not, so assert past it.
          p_user_id: (retainedOwnerByPath.get(audioPath) ?? null) as string,
          p_severity: 'error',
          p_reason: removeError.message,
          p_attempt_count: 1,
          p_metadata: { bucket: 'audio', retentionDays: AUDIO_RETENTION_DAYS },
        });
        if (deadLetterError) {
          errors.push(`Could not record audio cleanup failure: ${deadLetterError.message}`);
        }
      }
    } else {
      removedAudioCount = audioPaths.length;
      const { error: resolvedCleanupError } = await supabase
        .from('backend_dead_letters')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_note: 'Private audio object was removed by retention reconciliation.',
        })
        .eq('work_type', 'audio_cleanup')
        .eq('status', 'open')
        .in('work_key', audioPaths);
      if (resolvedCleanupError) {
        errors.push(`Could not resolve audio cleanup alerts: ${resolvedCleanupError.message}`);
      }
    }
  }

  let analysisDidWork = false;
  try {
    const analysisResult = await runMusicAnalysisForUpload({ supabase });
    analysisDidWork = Boolean(analysisResult.analysisId);
    if (analysisDidWork) analysisClaimedCount = 1;
    if (analysisResult.ok) {
      analysisCompletedCount = 1;
    } else if (analysisResult.retryScheduled) {
      analysisRetryScheduledCount = 1;
    } else if (
      !analysisResult.pending &&
      !analysisResult.cancelled &&
      analysisResult.analysisId &&
      analysisResult.userId
    ) {
      analysisTerminalFailureCount = 1;
      await markLinkedShowGenerationFailed({
        supabase,
        userId: analysisResult.userId,
        musicAnalysisId: analysisResult.analysisId,
        error: analysisResult.error,
      });
    } else if (!analysisResult.idle && !analysisResult.retryScheduled) {
      errors.push(analysisResult.error);
    }
  } catch (error) {
    // Conservatively avoid starting another long job when the analysis worker
    // failed outside its normal result contract.
    analysisDidWork = true;
    errors.push(
      `Analysis reconciliation crashed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Run at most one long-lived job per invocation. A completed analysis makes
  // its waiting show claimable on the next scheduled reconciliation.
  if (!analysisDidWork) {
    try {
      const cueResult = await generateCuesForShow({ supabase });
      if ('showId' in cueResult && cueResult.showId) cueClaimedCount = 1;
      if (cueResult.ok && !('pending' in cueResult)) {
        cueCompletedCount = 1;
      } else if (
        cueResult.ok &&
        'pending' in cueResult &&
        cueResult.reason === 'cue_generation_retry_scheduled'
      ) {
        cueRetryScheduledCount = 1;
      } else if (!cueResult.ok) {
        cueTerminalFailureCount = 1;
        errors.push(cueResult.error);
      }
    } catch (error) {
      errors.push(
        `Cue reconciliation crashed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Repair reservations from terminal shows created before the atomic cue
  // lifecycle migration, or from an old worker interrupted at that boundary.
  const { data: reservedShows, error: reservationError } = await supabase
    .from('ai_credit_transactions')
    .select('reference_id')
    .eq('reference_type', 'shows')
    .eq('transaction_type', 'reserve')
    .eq('status', 'reserved')
    .not('reference_id', 'is', null)
    .limit(CREDIT_REPAIR_BATCH_SIZE);
  if (reservationError) {
    errors.push(`Could not inspect reserved show credits: ${reservationError.message}`);
  } else {
    for (const reservation of reservedShows ?? []) {
      if (!reservation.reference_id) continue;
      const { data: show, error: showError } = await supabase
        .from('shows')
        .select('generation_status, generation_error')
        .eq('id', reservation.reference_id)
        .maybeSingle();
      if (showError) {
        errors.push(
          `Could not inspect show credit ${reservation.reference_id}: ${showError.message}`,
        );
        continue;
      }
      const outcome =
        show?.generation_status === 'completed'
          ? 'settled'
          : show?.generation_status === 'failed'
            ? 'refunded'
            : null;
      if (!outcome) continue;
      const { error: resolveError } = await supabase.rpc(
        'resolve_reconciled_show_generation_credit',
        {
          p_show_id: reservation.reference_id,
          p_outcome: outcome,
          p_reason:
            outcome === 'settled'
              ? 'Reconciled completed show generation'
              : (show?.generation_error ?? 'Reconciled failed show generation'),
        },
      );
      if (resolveError) {
        errors.push(
          `Could not resolve show credit ${reservation.reference_id}: ${resolveError.message}`,
        );
      } else {
        repairedShowCredits += 1;
      }
    }
  }

  const [{ data: health, error: healthError }, { data: deadLetters, error: deadLetterError }] =
    await Promise.all([
      supabase.rpc('get_backend_lifecycle_health'),
      supabase
        .from('backend_dead_letters')
        .select(
          'id, work_type, work_key, severity, reason, attempt_count, occurrence_count, first_observed_at, last_observed_at',
        )
        .eq('status', 'open')
        .order('last_observed_at', { ascending: false })
        .limit(25),
    ]);
  if (healthError) errors.push(`Could not read backend lifecycle health: ${healthError.message}`);
  if (deadLetterError)
    errors.push(`Could not read backend dead letters: ${deadLetterError.message}`);

  return NextResponse.json(
    {
      ok: errors.length === 0,
      analysis: {
        expiredCount: expiredAnalysisCount,
        claimedCount: analysisClaimedCount,
        completedCount: analysisCompletedCount,
        retryScheduledCount: analysisRetryScheduledCount,
        terminalFailureCount: analysisTerminalFailureCount,
      },
      cueGeneration: {
        expiredCount: expiredCueCount,
        claimedCount: cueClaimedCount,
        completedCount: cueCompletedCount,
        retryScheduledCount: cueRetryScheduledCount,
        terminalFailureCount: cueTerminalFailureCount,
      },
      retention: {
        purgedAnalysisCount,
        removedAudioCount,
      },
      repairedShowCredits,
      health,
      deadLetters: deadLetters ?? [],
      errors,
    },
    { status: errors.length === 0 ? 200 : 500 },
  );
}
