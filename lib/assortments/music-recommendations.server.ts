import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getAssortmentServiceClient, type PublicAssortment } from '@/lib/assortments/public.server';
import { browseJamendoTracks } from '@/lib/jamendo.server';
import type { JamendoSearchTrack } from '@/lib/music-library.types';
import { rankAssortmentMusic } from '@/lib/music-recommendations';
import { parseStoredAnalyserResult } from '@/lib/show-analysis-validation';
import { loadProductTimingProfiles } from '@/lib/cue-generation/product-timing.server';
import { listFireworkProducts } from '@/lib/shows/queries.server';
import type { AnalyserResult } from '@/lib/show-analysis.types';

const RECOMMENDATION_GENRES = [null, 'ambient', 'electronic'] as const;
const BROWSE_COUNT = 20;
const MAX_CANDIDATES = 60;
const MAX_ANALYSIS_ROWS = 300;

type ServiceClient = SupabaseClient<Database>;

export type AssortmentRecommendationResponse = {
  tracks: JamendoSearchTrack[];
  reasons: Record<string, string[]>;
};

function uniqueTracks(pages: Array<{ tracks: JamendoSearchTrack[] }>): JamendoSearchTrack[] {
  const byId = new Map<string, JamendoSearchTrack>();
  for (const page of pages) {
    for (const track of page.tracks) {
      if (!byId.has(track.trackId) && byId.size < MAX_CANDIDATES) byId.set(track.trackId, track);
    }
  }
  return [...byId.values()];
}

/**
 * Build public recommendations from the assortment's products and previously
 * completed, owner-scoped Jamendo analyses. This function is read-only: it
 * never creates selections, analyses, shows, uploads or charges.
 */
export async function recommendAssortmentMusic(
  assortment: Pick<PublicAssortment, 'fundingUserId' | 'items'>,
  options: { supabase?: ServiceClient } = {},
): Promise<AssortmentRecommendationResponse> {
  const supabase = options.supabase ?? getAssortmentServiceClient();
  const pages = await Promise.all(
    RECOMMENDATION_GENRES.map((genre) => browseJamendoTracks(genre, 0, BROWSE_COUNT)),
  );
  const tracks = uniqueTracks(pages);
  if (tracks.length === 0) return { tracks: [], reasons: {} };

  const productIds = new Set(assortment.items.map((item) => item.catalogueItemId));
  if (productIds.size === 0 || productIds.size > 100) {
    throw new Error('The assortment cannot be profiled for music recommendations.');
  }
  const products = await listFireworkProducts({ scopedRead: { supabase, ids: [...productIds] } });
  if (products.length !== productIds.size)
    throw new Error('Assortment product timing is unavailable.');
  const timingProfiles = await loadProductTimingProfiles(supabase, products);

  const { data: rows, error } = await supabase
    .from('song_analyses')
    .select('source_track_id, analysis_json')
    .eq('user_id', assortment.fundingUserId)
    .eq('source_provider', 'jamendo')
    .eq('status', 'completed')
    .not('analysis_json', 'is', null)
    .in(
      'source_track_id',
      tracks.map((track) => track.trackId),
    )
    .order('completed_at', { ascending: false })
    .limit(MAX_ANALYSIS_ROWS);
  if (error) {
    console.error('[assortment-qr/jamendo] recommendation analysis lookup failed:', error);
    throw new Error('Music recommendations could not be loaded.', { cause: error });
  }

  const analyses = new Map<string, AnalyserResult>();
  for (const row of rows ?? []) {
    if (!row.source_track_id || analyses.has(row.source_track_id) || row.analysis_json == null) {
      continue;
    }
    try {
      analyses.set(row.source_track_id, parseStoredAnalyserResult(row.analysis_json));
    } catch (parseError) {
      // A malformed historical payload is not reusable evidence. Other DB
      // failures above remain fatal so a broken query cannot look like no data.
      console.warn('[assortment-qr/jamendo] invalid stored analysis skipped:', parseError);
    }
  }

  const ranked = rankAssortmentMusic({
    items: assortment.items.map(({ catalogueItemId, quantity }) => ({ catalogueItemId, quantity })),
    timingProfiles,
    tracks,
    analyses,
  });
  return {
    tracks: ranked.map(({ track }) => track),
    reasons: Object.fromEntries(ranked.map(({ track, reasons }) => [track.trackId, reasons])),
  };
}
