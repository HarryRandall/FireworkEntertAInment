/** Authenticated workspace summary for the sidebar and dashboard chrome. */

import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/current-user.server';
import { getWorkspaceSummary } from '@/lib/show-summary.server';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  const summary = await getWorkspaceSummary();
  return NextResponse.json(summary);
}
