/** Return the authenticated user's latest analysis snapshot for one show. */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/current-user.server';
import { getLatestAnalysisForShow } from '@/lib/show-analyses.server';

const ShowIdSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  const parsedShowId = ShowIdSchema.safeParse((await params).id);
  if (!parsedShowId.success) {
    return NextResponse.json({ error: 'Show id is invalid.' }, { status: 400 });
  }

  try {
    const analysis = await getLatestAnalysisForShow(parsedShowId.data);
    return NextResponse.json({ analysis }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[show-analysis] snapshot read failed:', error);
    return NextResponse.json({ error: 'Song analysis could not be loaded.' }, { status: 500 });
  }
}
