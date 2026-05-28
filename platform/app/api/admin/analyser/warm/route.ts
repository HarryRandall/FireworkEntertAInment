/** Cron-safe analyser warm-up endpoint. */

import { NextResponse } from 'next/server';
import { refreshAnalyserWarmth } from '@/lib/analyser-warmth.server';

export const dynamic = 'force-dynamic';

function isAuthorised(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }

  const result = await refreshAnalyserWarmth();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
