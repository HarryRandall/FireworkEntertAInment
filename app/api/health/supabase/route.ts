/** GET health-check endpoint verifying the Supabase connection. */

import { NextResponse } from 'next/server';
import { createPublicServerSupabase } from '@/utils/supabase/public-server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' } as const;

function unavailableResponse() {
  return NextResponse.json(
    { ok: false, message: 'Supabase health check failed.' },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}

/**
 * GET /api/health/supabase
 * Confirms Supabase env is present and the app can read an intentionally
 * public browse table.
 * Safe to call from production after deploy; does not expose secrets.
 */
export async function GET() {
  const supabase = createPublicServerSupabase();
  if (!supabase) {
    console.error('[api/health/supabase] Supabase server environment is unavailable.');
    return unavailableResponse();
  }

  try {
    const { error } = await supabase.from('show_presets').select('id').limit(1);

    if (error) {
      console.error('[api/health/supabase] public database probe failed:', error);
      return unavailableResponse();
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Supabase is reachable.',
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('[api/health/supabase] public database probe threw:', error);
    return unavailableResponse();
  }
}
