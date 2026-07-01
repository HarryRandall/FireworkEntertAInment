/** Authenticated workspace summary for the sidebar and dashboard chrome. */

import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/current-user.server';
import { getWorkspaceSummary } from '@/lib/show-summary.server';
import { getSidebarAiUsageSummary } from '@/lib/ai-credits.server';
import { ShowsNetworkError } from '@/lib/shows.server';
import { isSupabaseTransientNetworkError } from '@/utils/supabase/errors';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  try {
    const [summary, aiUsage] = await Promise.all([
      getWorkspaceSummary(),
      getSidebarAiUsageSummary(),
    ]);
    return NextResponse.json({ ...summary, aiUsage });
  } catch (error) {
    if (error instanceof ShowsNetworkError || isSupabaseTransientNetworkError(error)) {
      return NextResponse.json(
        { ok: false, error: 'Workspace summary is temporarily unavailable.' },
        { status: 503 },
      );
    }
    throw error;
  }
}
