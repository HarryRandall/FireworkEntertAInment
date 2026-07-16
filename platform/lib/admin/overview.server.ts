import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { Database } from '@/lib/database.types';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import {
  DEFAULT_ADMIN_OVERVIEW_RANGE_KEY,
  getAdminOverviewRangeOption,
  getAdminOverviewRangeWindow,
  type AdminOverviewRangeKey,
} from './overview-range';
import { ADMIN_CACHE_TTL_SECONDS, getAdminOverviewCacheKey } from './cache-keys';
import { requirePermission } from './current-user.server';
import { getServerClient } from './supabase';

type ShowRow = Pick<
  Database['public']['Tables']['shows']['Row'],
  | 'id'
  | 'title'
  | 'slug'
  | 'status'
  | 'generation_status'
  | 'created_at'
  | 'updated_at'
  | 'duration_seconds'
  | 'total_cents'
  | 'effects_count'
  | 'generated_cue_count'
  | 'location'
>;

type AnalysisRow = Pick<
  Database['public']['Tables']['song_analyses']['Row'],
  'id' | 'status' | 'created_at' | 'completed_at' | 'runtime_ms'
>;

type CueRow = Pick<Database['public']['Tables']['show_timeline_items']['Row'], 'created_at'>;

export type AdminOverviewShowMetric = {
  id: string;
  title: string;
  slug: string;
  status: string;
  generationStatus: string;
  createdAt: string;
  updatedAt: string;
  durationSeconds: number | null;
  totalCents: number;
  effectsCount: number;
  generatedCueCount: number | null;
  location: string | null;
};

export type AdminOverviewAnalysisMetric = {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  runtimeMs: number | null;
};

export type AdminOverviewCueMetric = {
  createdAt: string;
};

export type AdminOverviewMetrics = {
  previousMusicAnalyses: number;
  previousShowCues: number;
  previousShows: number;
  totalShows: number;
  totalShowCues: number;
  totalMusicAnalyses: number;
  recentShows: AdminOverviewShowMetric[];
  recentMusicAnalyses: AdminOverviewAnalysisMetric[];
  recentShowCues: AdminOverviewCueMetric[];
};

const EMPTY_METRICS: AdminOverviewMetrics = {
  previousMusicAnalyses: 0,
  previousShowCues: 0,
  previousShows: 0,
  totalShows: 0,
  totalShowCues: 0,
  totalMusicAnalyses: 0,
  recentShows: [],
  recentMusicAnalyses: [],
  recentShowCues: [],
};

function mapShow(row: ShowRow): AdminOverviewShowMetric {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    generationStatus: row.generation_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    durationSeconds: row.duration_seconds,
    totalCents: row.total_cents,
    effectsCount: row.effects_count,
    generatedCueCount: row.generated_cue_count,
    location: row.location,
  };
}

function mapAnalysis(row: AnalysisRow): AdminOverviewAnalysisMetric {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    runtimeMs: row.runtime_ms,
  };
}

function mapCue(row: CueRow): AdminOverviewCueMetric {
  return { createdAt: row.created_at };
}

function throwOverviewReadErrors(results: Array<{ operation: string; error: unknown }>): void {
  const failures = results.filter(({ error }) => error !== null);
  if (failures.length === 0) return;

  console.error('[admin.overview] metric reads failed:', failures);
  throw new Error('Admin overview metrics could not be loaded.', {
    cause: failures[0]?.error,
  });
}

/** Returns platform overview metrics for the admin dashboard. */
export async function getAdminOverviewMetrics(
  rangeKey: AdminOverviewRangeKey = DEFAULT_ADMIN_OVERVIEW_RANGE_KEY,
): Promise<AdminOverviewMetrics> {
  if (!(await requirePermission('admin.view'))) return EMPTY_METRICS;

  const range = getAdminOverviewRangeOption(rangeKey);
  const rangeWindow = getAdminOverviewRangeWindow(range.key);
  const cacheKey = getAdminOverviewCacheKey(range.key);
  const cached = await getCachedJson<AdminOverviewMetrics>(cacheKey);
  if (cached) return cached;

  const supabase = createServiceRoleSupabase() ?? (await getServerClient());

  const [
    currentShowsResult,
    previousShowsResult,
    recentShowsResult,
    currentShowCuesResult,
    previousShowCuesResult,
    recentShowCuesResult,
    currentMusicAnalysesResult,
    previousMusicAnalysesResult,
    recentMusicAnalysesResult,
  ] = await Promise.all([
    supabase
      .from('shows')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', rangeWindow.startIso)
      .lt('created_at', rangeWindow.endIso),
    supabase
      .from('shows')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', rangeWindow.previousStartIso)
      .lt('created_at', rangeWindow.previousEndIso),
    supabase
      .from('shows')
      .select(
        'id, title, slug, status, generation_status, created_at, updated_at, duration_seconds, total_cents, effects_count, generated_cue_count, location',
      )
      .gte('created_at', rangeWindow.startIso)
      .lt('created_at', rangeWindow.endIso)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('show_timeline_items')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', rangeWindow.startIso)
      .lt('created_at', rangeWindow.endIso),
    supabase
      .from('show_timeline_items')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', rangeWindow.previousStartIso)
      .lt('created_at', rangeWindow.previousEndIso),
    supabase
      .from('show_timeline_items')
      .select('created_at')
      .gte('created_at', rangeWindow.startIso)
      .lt('created_at', rangeWindow.endIso)
      .order('created_at', { ascending: false })
      .limit(4000),
    supabase
      .from('song_analyses')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', rangeWindow.startIso)
      .lt('created_at', rangeWindow.endIso),
    supabase
      .from('song_analyses')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', rangeWindow.previousStartIso)
      .lt('created_at', rangeWindow.previousEndIso),
    supabase
      .from('song_analyses')
      .select('id, status, created_at, completed_at, runtime_ms')
      .gte('created_at', rangeWindow.startIso)
      .lt('created_at', rangeWindow.endIso)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  throwOverviewReadErrors([
    { operation: 'current shows query', error: currentShowsResult.error },
    { operation: 'previous shows query', error: previousShowsResult.error },
    { operation: 'recent shows query', error: recentShowsResult.error },
    { operation: 'current cues query', error: currentShowCuesResult.error },
    { operation: 'previous cues query', error: previousShowCuesResult.error },
    { operation: 'recent cues query', error: recentShowCuesResult.error },
    { operation: 'current music analyses query', error: currentMusicAnalysesResult.error },
    { operation: 'previous music analyses query', error: previousMusicAnalysesResult.error },
    { operation: 'recent music analyses query', error: recentMusicAnalysesResult.error },
  ]);

  const metrics: AdminOverviewMetrics = {
    previousShows: previousShowsResult.count ?? 0,
    previousShowCues: previousShowCuesResult.count ?? 0,
    previousMusicAnalyses: previousMusicAnalysesResult.count ?? 0,
    totalShows: currentShowsResult.count ?? 0,
    totalShowCues: currentShowCuesResult.count ?? 0,
    totalMusicAnalyses: currentMusicAnalysesResult.count ?? 0,
    recentShows: ((recentShowsResult.data ?? []) as ShowRow[]).map(mapShow),
    recentShowCues: ((recentShowCuesResult.data ?? []) as CueRow[]).map(mapCue),
    recentMusicAnalyses: ((recentMusicAnalysesResult.data ?? []) as AnalysisRow[]).map(mapAnalysis),
  };

  await setCachedJson(cacheKey, metrics, ADMIN_CACHE_TTL_SECONDS);
  return metrics;
}
