/**
 * GET handler returning the opening card-preview replay cues for a show.
 *
 * The `/shows` grid hover preview used to fetch cues through a server action,
 * but Next serialises in-flight actions with navigations, so clicking a card
 * while its preview cues were loading stalled the route change. A plain GET
 * fetch never blocks navigation. Ownership is enforced by
 * `listReplayPreviewCuesForShow` (current-user check plus RLS).
 */
import { NextResponse } from 'next/server';
import { listReplayPreviewCuesForShow, ShowsNetworkError } from '@/lib/shows.server';
import { SHOW_CARD_PREVIEW_WINDOW_SECONDS } from '@/lib/show-preview';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ cues: [] }, { status: 400 });

  const windowParam = Number(new URL(req.url).searchParams.get('window'));
  const windowSeconds =
    Number.isFinite(windowParam) && windowParam > 0
      ? windowParam
      : SHOW_CARD_PREVIEW_WINDOW_SECONDS;

  try {
    const cues = await listReplayPreviewCuesForShow(id, windowSeconds);
    return NextResponse.json({ cues });
  } catch (error) {
    if (error instanceof ShowsNetworkError) {
      return NextResponse.json({ cues: [] }, { status: 503 });
    }
    throw error;
  }
}
