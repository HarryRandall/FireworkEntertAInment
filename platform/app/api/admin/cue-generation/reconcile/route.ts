/** Cron-safe recovery for one bounded cue-generation job. */

import { NextResponse } from 'next/server';
import { generateCuesForShow } from '@/lib/cue-generation.server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const EXPIRED_BATCH_SIZE = 10;

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
      { ok: false, error: 'Cue-generation reconciliation is not configured.' },
      { status: 503 },
    );
  }

  const errors: string[] = [];
  let expiredCount = 0;
  let claimedCount = 0;
  let completedCount = 0;
  let retryScheduledCount = 0;
  let terminalFailureCount = 0;

  const expiry = await supabase.rpc('expire_exhausted_cue_generations', {
    p_limit: EXPIRED_BATCH_SIZE,
    p_max_attempts: 3,
  });
  if (expiry.error) {
    errors.push(`Could not expire exhausted cue generation: ${expiry.error.message}`);
  } else {
    expiredCount = expiry.data?.length ?? 0;
  }

  // One invocation claims at most one ready show. Analyses have a separate
  // cron route, so any number of pending polls cannot starve this queue.
  try {
    const result = await generateCuesForShow({ supabase });
    if ('showId' in result && result.showId) claimedCount = 1;
    if (result.ok && !('pending' in result)) {
      completedCount = 1;
    } else if (
      result.ok &&
      'pending' in result &&
      result.reason === 'cue_generation_retry_scheduled'
    ) {
      retryScheduledCount = 1;
    } else if (!result.ok) {
      terminalFailureCount = 1;
      errors.push(result.error);
    }
  } catch (error) {
    errors.push(
      `Cue reconciliation crashed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return NextResponse.json(
    {
      ok: errors.length === 0,
      cueGeneration: {
        expiredCount,
        claimedCount,
        completedCount,
        retryScheduledCount,
        terminalFailureCount,
      },
      errors,
    },
    { status: errors.length === 0 ? 200 : 500 },
  );
}
