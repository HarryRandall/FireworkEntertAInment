import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { Database } from '@/lib/database.types';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
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
  totalShows: number;
  totalShowCues: number;
  totalMusicAnalyses: number;
  recentShows: AdminOverviewShowMetric[];
  recentMusicAnalyses: AdminOverviewAnalysisMetric[];
  recentShowCues: AdminOverviewCueMetric[];
};

const EMPTY_METRICS: AdminOverviewMetrics = {
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

function logOverviewError(label: string, error: unknown) {
  if (error) console.error(`[admin.overview] ${label} failed:`, error);
}

/** Returns platform overview metrics for the admin dashboard. */
export async function getAdminOverviewMetrics(): Promise<AdminOverviewMetrics> {
  if (!(await requirePermission('admin.view'))) return EMPTY_METRICS;

  const cacheKey = getAdminOverviewCacheKey();
  const cached = await getCachedJson<AdminOverviewMetrics>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const since = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const supabase = createServiceRoleSupabase() ?? (await getServerClient());

  const [
    totalShowsResult,
    recentShowsResult,
    totalShowCuesResult,
    recentShowCuesResult,
    totalMusicAnalysesResult,
    recentMusicAnalysesResult,
  ] = await Promise.all([
    supabase.from('shows').select('id', { count: 'exact', head: true }),
    supabase
      .from('shows')
      .select(
        'id, title, slug, status, generation_status, created_at, updated_at, duration_seconds, total_cents, effects_count, generated_cue_count, location',
      )
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase.from('show_timeline_items').select('id', { count: 'exact', head: true }),
    supabase
      .from('show_timeline_items')
      .select('created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(4000),
    supabase.from('song_analyses').select('id', { count: 'exact', head: true }),
    supabase
      .from('song_analyses')
      .select('id, status, created_at, completed_at, runtime_ms')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  logOverviewError('total shows query', totalShowsResult.error);
  logOverviewError('recent shows query', recentShowsResult.error);
  logOverviewError('total cues query', totalShowCuesResult.error);
  logOverviewError('recent cues query', recentShowCuesResult.error);
  logOverviewError('total music analyses query', totalMusicAnalysesResult.error);
  logOverviewError('recent music analyses query', recentMusicAnalysesResult.error);

  const metrics: AdminOverviewMetrics = {
    totalShows: totalShowsResult.count ?? 0,
    totalShowCues: totalShowCuesResult.count ?? 0,
    totalMusicAnalyses: totalMusicAnalysesResult.count ?? 0,
    recentShows: ((recentShowsResult.data ?? []) as ShowRow[]).map(mapShow),
    recentShowCues: ((recentShowCuesResult.data ?? []) as CueRow[]).map(mapCue),
    recentMusicAnalyses: ((recentMusicAnalysesResult.data ?? []) as AnalysisRow[]).map(mapAnalysis),
  };

  await setCachedJson(cacheKey, metrics, ADMIN_CACHE_TTL_SECONDS);
  return metrics;
}
