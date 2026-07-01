'use server';

/**
 * Lazy replay-cue fetch for `/shows` cards. The card list renders from the
 * dashboard summary (no cue dependency) so shows stream in immediately; each
 * card only fetches its own cues once the user has confirmed hover intent, so
 * grazing the grid never triggers a query or WebGL load.
 */
import { listReplayCuesForShow } from '@/lib/shows.server';
import type { ReplayCue } from '@/lib/show-domain';

export async function getShowReplayCues(showId: string): Promise<ReplayCue[]> {
  if (!showId) return [];
  return listReplayCuesForShow(showId);
}
