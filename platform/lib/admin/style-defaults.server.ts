import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type {
  AdminStyleDefaultDetail,
  AdminStyleDefaultOption,
  AdminStyleDefaultOptions,
  AdminStyleDefaultSummary,
} from '@/lib/admin.types';
import type { Database, Json } from '@/lib/database.types';
import { ADMIN_CACHE_TTL_SECONDS, getAdminStyleDefaultsCacheKey } from './cache-keys';
import { requirePermission } from './current-user.server';
import { listStyleDefaultEditorVersions } from './editor-versions.server';
import { describeSupabaseError, isMissingStyleDefaultSchemaError } from './style-default-schema';
import { getServerClient } from './supabase';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  isFireworkStyleDefaultKind,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';

type StyleDefaultRow = Database['public']['Tables']['firework_style_defaults']['Row'];

function normaliseKind(kind: string): FireworkStyleDefaultKind {
  return isFireworkStyleDefaultKind(kind) ? kind : 'star';
}

function toOption(row: StyleDefaultRow): AdminStyleDefaultOption {
  return {
    id: row.id,
    kind: normaliseKind(row.kind),
    name: row.name,
    description: row.description,
    defaultsJson: row.defaults_json as Json,
  };
}

function groupedOptions(summaries: AdminStyleDefaultSummary[]): AdminStyleDefaultOptions {
  const grouped = Object.fromEntries(
    FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => [kind, []]),
  ) as unknown as AdminStyleDefaultOptions;
  for (const item of summaries) {
    if (item.isArchived) continue;
    grouped[item.kind].push(toOptionFromSummary(item));
  }
  return grouped;
}

function toOptionFromSummary(summary: AdminStyleDefaultSummary): AdminStyleDefaultOption {
  return {
    id: summary.id,
    kind: summary.kind,
    name: summary.name,
    description: summary.description,
    defaultsJson: summary.defaultsJson,
  };
}

export async function listAdminStyleDefaults(): Promise<AdminStyleDefaultSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const cacheKey = getAdminStyleDefaultsCacheKey();
  const cached = await getCachedJson<AdminStyleDefaultSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const defaultsResult = await supabase
    .from('firework_style_defaults')
    .select(
      'id, slug, name, description, kind, defaults_json, sort_order, is_archived, created_at, updated_at',
    )
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (defaultsResult.error) {
    if (!isMissingStyleDefaultSchemaError(defaultsResult.error)) {
      console.error(
        '[admin.style-defaults] list defaults failed:',
        describeSupabaseError(defaultsResult.error),
      );
    }
    return [];
  }
  const mapped = ((defaultsResult.data ?? []) as StyleDefaultRow[]).map((row) => ({
    ...toOption(row),
    slug: row.slug,
    sortOrder: row.sort_order,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

export async function listAdminStyleDefaultOptions(): Promise<AdminStyleDefaultOptions> {
  return groupedOptions(await listAdminStyleDefaults());
}

export async function getAdminStyleDefaultById(
  defaultId: string,
): Promise<AdminStyleDefaultDetail | null> {
  const defaults = await listAdminStyleDefaults();
  const styleDefault = defaults.find((item) => item.id === defaultId);
  if (!styleDefault) return null;

  const supabase = await getServerClient();
  return {
    ...styleDefault,
    history: await listStyleDefaultEditorVersions(supabase, defaultId),
  };
}
