import 'server-only';

import { cache } from 'react';
import { listShowTemplates } from '@/lib/admin.server';
import type { ShowTemplate } from '@/lib/admin.types';
import type { Database } from '@/lib/database.types';
import { getCurrentUserId } from '@/lib/current-user.server';
import { mapShow } from '@/lib/shows/mappers';
import { getServerClient } from '@/lib/shows/supabase';
import { SHOW_SELECT, type ShowProjection } from '@/lib/shows/types';
import { listShowsForCurrentUser, ShowsNetworkError } from '@/lib/shows.server';
import type { Show } from '@/lib/show-domain';
import {
  mapShowToSummary,
  mapTemplateToSummary,
  type DashboardSummary,
  type WorkspaceSummary,
} from '@/lib/show-summary';
import { isSupabaseTransientNetworkError } from '@/utils/supabase/errors';

type WorkspaceTotalRow = Pick<
  Database['public']['Tables']['shows']['Row'],
  'duration_seconds' | 'total_cents' | 'budget_cents'
>;

const EMPTY_WORKSPACE_SUMMARY: WorkspaceSummary = {
  showCount: 0,
  totalRuntimeSeconds: 0,
  totalCatalogueValueCents: 0,
  recentShows: [],
};

function buildDashboardSummary(shows: Show[], templates: ShowTemplate[]): DashboardSummary {
  const showSummaries = shows.map(mapShowToSummary);
  const templateSummaries = templates.map(mapTemplateToSummary);
  const totalRuntimeSeconds = showSummaries.reduce(
    (total, show) => total + (show.lengthSeconds ?? 0),
    0,
  );
  const totalCatalogueValueCents = showSummaries.reduce(
    (total, show) => total + show.totalCostCents,
    0,
  );

  return {
    showCount: showSummaries.length,
    totalRuntimeSeconds,
    totalCatalogueValueCents,
    recentShows: showSummaries.slice(0, 5),
    allShows: showSummaries,
    communityTemplates: [...templateSummaries]
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.likes - a.likes)
      .slice(0, 3),
  };
}

export const getDashboardSummary = cache(async (): Promise<DashboardSummary> => {
  const [shows, templates] = await Promise.all([listShowsForCurrentUser(), listShowTemplates()]);
  return buildDashboardSummary(shows, templates);
});

export const getDashboardSummaryWithTemplates = cache(
  async (): Promise<{
    summary: DashboardSummary;
    templates: ShowTemplate[];
  }> => {
    const [shows, templates] = await Promise.all([listShowsForCurrentUser(), listShowTemplates()]);
    return {
      summary: buildDashboardSummary(shows, templates),
      templates,
    };
  },
);

export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  const userId = await getCurrentUserId();
  if (!userId) return EMPTY_WORKSPACE_SUMMARY;

  const supabase = await getServerClient();
  const [totalsResult, recentResult] = await Promise.all([
    supabase
      .from('shows')
      .select('duration_seconds, total_cents, budget_cents', { count: 'exact' })
      .eq('user_id', userId),
    supabase
      .from('shows')
      .select(SHOW_SELECT)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(3),
  ]);

  const readError = totalsResult.error ?? recentResult.error;
  if (readError) {
    if (isSupabaseTransientNetworkError(readError)) throw new ShowsNetworkError(readError);
    console.error('[show-summary] workspace summary read failed:', readError);
    throw new Error('Workspace summary could not be loaded.', { cause: readError });
  }
  if (totalsResult.count === null) {
    throw new Error('Workspace summary count was not returned.');
  }

  const totals = (totalsResult.data ?? []) as WorkspaceTotalRow[];
  const recentShows = ((recentResult.data ?? []) as ShowProjection[]).map((row) =>
    mapShowToSummary(mapShow(row)),
  );

  return {
    showCount: totalsResult.count,
    totalRuntimeSeconds: totals.reduce((total, row) => total + (row.duration_seconds ?? 0), 0),
    totalCatalogueValueCents: totals.reduce(
      (total, row) => total + (row.total_cents ?? row.budget_cents ?? 0),
      0,
    ),
    recentShows,
  };
}
