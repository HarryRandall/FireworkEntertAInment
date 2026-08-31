/** Read-only lifecycle health plus explicit dead-letter resolution. */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

export const dynamic = 'force-dynamic';

const ResolutionSchema = z.object({
  deadLetterId: z.string().uuid(),
  status: z.enum(['resolved', 'ignored']),
  note: z.string().trim().min(1).max(1000),
});

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
      { ok: false, error: 'Backend lifecycle health is not configured.' },
      { status: 503 },
    );
  }

  const [{ data: health, error: healthError }, { data: deadLetters, error: listError }] =
    await Promise.all([
      supabase.rpc('get_backend_lifecycle_health'),
      supabase
        .from('backend_dead_letters')
        .select(
          'id, work_type, work_key, user_id, severity, reason, attempt_count, occurrence_count, metadata, first_observed_at, last_observed_at',
        )
        .eq('status', 'open')
        .order('last_observed_at', { ascending: false })
        .limit(100),
    ]);
  if (healthError || listError) {
    console.error('[backend-lifecycle] health read failed:', healthError ?? listError);
    return NextResponse.json(
      { ok: false, error: 'Could not read backend lifecycle health.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, health, deadLetters: deadLetters ?? [] });
}

export async function PATCH(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }
  const supabase = createServiceRoleSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Backend lifecycle health is not configured.' },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = ResolutionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Dead-letter resolution is invalid.' },
      { status: 400 },
    );
  }

  const { data: resolved, error } = await supabase.rpc('resolve_backend_dead_letter', {
    p_dead_letter_id: parsed.data.deadLetterId,
    p_status: parsed.data.status,
    p_resolution_note: parsed.data.note,
  });
  if (error) {
    console.error('[backend-lifecycle] dead-letter resolution failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not resolve backend dead letter.' },
      { status: 500 },
    );
  }
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: 'Open backend dead letter was not found.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
