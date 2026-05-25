/** GET health-check endpoint verifying the Supabase connection. */

import { createClient } from '@/utils/supabase/server';
import { getSupabaseServerEnv } from '@/utils/supabase/env';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * GET /api/health/supabase
 * Confirms Supabase env is present and the app can reach Supabase (auth endpoint).
 * Safe to call from production after deploy; does not expose secrets.
 */
export async function GET() {
  if (!getSupabaseServerEnv()) {
    return NextResponse.json(
      {
        ok: false,
        step: 'env',
        message:
          'Missing Supabase URL/key. Use NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY (optional: SUPABASE_URL, SUPABASE_ANON_KEY on server).',
      },
      { status: 503 },
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          step: 'supabase',
          message: error.message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      step: 'supabase',
      message: 'Reachable (auth.getUser completed; user may be anonymous)',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, step: 'exception', message }, { status: 503 });
  }
}
