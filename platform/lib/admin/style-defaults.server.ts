import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type {
  AdminStyleDefaultIdMap,
  AdminStyleDefaultLinkMap,
  AdminStyleDefaultDetail,
  AdminStyleDefaultOption,
  AdminStyleDefaultOptions,
  AdminStyleDefaultSummary,
} from '@/lib/admin.types';
import type { Database, Json } from '@/lib/database.types';
import { ADMIN_CACHE_TTL_SECONDS, getAdminStyleDefaultsCacheKey } from './cache-keys';
import { requirePermission } from './current-user.server';
import { describeSupabaseError, isMissingStyleDefaultSchemaError } from './style-default-schema';
import { getServerClient } from './supabase';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  isFireworkStyleDefaultKind,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';

type StyleDefaultRow = Database['public']['Tables']['firework_style_defaults']['Row'];
type ServerClient = Awaited<ReturnType<typeof getServerClient>>;

type LinkRow = {
  star_style_default_id: string | null;
  trail_style_default_id: string | null;
};

type StyleDefaultLinkRow = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  defaults_json: Json;
  is_archived?: boolean | null;
};

type OwnerStyleDefaultLinkRow = {
  kind: string;
  style_default_id: string;
  style_default?: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null;
};

type EffectStyleDefaultLinkRow = OwnerStyleDefaultLinkRow & {
  firework_effect_id: string;
};

type FireworkStyleDefaultLinkRow = OwnerStyleDefaultLinkRow & {
  firework_id: string;
};

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

function firstStyleDefault(
  value: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null | undefined,
): StyleDefaultLinkRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function mapStyleDefaultOption(
  row: StyleDefaultLinkRow | null,
): AdminStyleDefaultOption | null {
  if (!row) return null;
  return {
    id: row.id,
    kind: normaliseKind(row.kind),
    name: row.name,
    description: row.description,
    defaultsJson: row.defaults_json as Json,
  };
}

function increment(counts: Map<string, number>, id: string | null | undefined): void {
  if (!id) return;
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function countLinkedRows(rows: LinkRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    increment(counts, row.star_style_default_id);
    increment(counts, row.trail_style_default_id);
  }
  return counts;
}

function countStyleDefaultLinkRows(
  rows: Array<{ style_default_id: string | null }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) increment(counts, row.style_default_id);
  return counts;
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
  const [defaultsResult, effectsResult, fireworksResult] = await Promise.all([
    supabase
      .from('firework_style_defaults')
      .select(
        'id, slug, name, description, kind, defaults_json, sort_order, is_archived, created_at, updated_at',
      )
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('firework_effects').select('star_style_default_id, trail_style_default_id'),
    supabase.from('fireworks').select('star_style_default_id, trail_style_default_id'),
  ]);

  const [effectLinkResult, fireworkLinkResult] = await Promise.all([
    supabase.from('firework_effect_style_default_links').select('style_default_id'),
    supabase.from('firework_style_default_links').select('style_default_id'),
  ]);

  if (defaultsResult.error) {
    if (!isMissingStyleDefaultSchemaError(defaultsResult.error)) {
      console.error(
        '[admin.style-defaults] list defaults failed:',
        describeSupabaseError(defaultsResult.error),
      );
    }
    return [];
  }
  if (effectsResult.error) {
    if (!isMissingStyleDefaultSchemaError(effectsResult.error)) {
      console.error(
        '[admin.style-defaults] count effect links failed:',
        describeSupabaseError(effectsResult.error),
      );
    }
  }
  if (fireworksResult.error) {
    if (!isMissingStyleDefaultSchemaError(fireworksResult.error)) {
      console.error(
        '[admin.style-defaults] count firework links failed:',
        describeSupabaseError(fireworksResult.error),
      );
    }
  }
  if (effectLinkResult.error && !isMissingStyleDefaultSchemaError(effectLinkResult.error)) {
    console.error(
      '[admin.style-defaults] count effect link rows failed:',
      describeSupabaseError(effectLinkResult.error),
    );
  }
  if (fireworkLinkResult.error && !isMissingStyleDefaultSchemaError(fireworkLinkResult.error)) {
    console.error(
      '[admin.style-defaults] count firework link rows failed:',
      describeSupabaseError(fireworkLinkResult.error),
    );
  }

  const effectCounts = effectLinkResult.error
    ? countLinkedRows((effectsResult.data ?? []) as LinkRow[])
    : countStyleDefaultLinkRows(
        (effectLinkResult.data ?? []) as Array<{ style_default_id: string | null }>,
      );
  const fireworkCounts = fireworkLinkResult.error
    ? countLinkedRows((fireworksResult.data ?? []) as LinkRow[])
    : countStyleDefaultLinkRows(
        (fireworkLinkResult.data ?? []) as Array<{ style_default_id: string | null }>,
      );
  const mapped = ((defaultsResult.data ?? []) as StyleDefaultRow[]).map((row) => ({
    ...toOption(row),
    slug: row.slug,
    sortOrder: row.sort_order,
    isArchived: row.is_archived,
    linkedEffectCount: effectCounts.get(row.id) ?? 0,
    linkedFireworkCount: fireworkCounts.get(row.id) ?? 0,
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
  return defaults.find((item) => item.id === defaultId) ?? null;
}

export function styleDefaultIdMapFromLinks(
  links: AdminStyleDefaultLinkMap,
): AdminStyleDefaultIdMap {
  const ids: AdminStyleDefaultIdMap = {};
  for (const kind of FIREWORK_STYLE_DEFAULT_KINDS) ids[kind] = links[kind]?.id ?? null;
  return ids;
}

export function legacyStyleDefaultLinks(input: {
  star?: AdminStyleDefaultOption | null;
  trail?: AdminStyleDefaultOption | null;
}): AdminStyleDefaultLinkMap {
  return {
    ...(input.star ? { star: input.star } : {}),
    ...(input.trail ? { trail: input.trail } : {}),
  };
}

function mapOwnerLinks(rows: OwnerStyleDefaultLinkRow[]): AdminStyleDefaultLinkMap {
  const links: AdminStyleDefaultLinkMap = {};
  for (const row of rows) {
    const kind = normaliseKind(row.kind);
    links[kind] = mapStyleDefaultOption(firstStyleDefault(row.style_default));
  }
  return links;
}

export async function loadEffectStyleDefaultLinkMap(
  supabase: ServerClient,
  effectIds: readonly string[],
): Promise<Record<string, AdminStyleDefaultLinkMap>> {
  if (effectIds.length === 0) return {};
  const { data, error } = await supabase
    .from('firework_effect_style_default_links')
    .select(
      'firework_effect_id, kind, style_default_id, style_default:firework_style_defaults!firework_effect_style_default_links_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived)',
    )
    .in('firework_effect_id', [...effectIds]);

  if (error) {
    if (!isMissingStyleDefaultSchemaError(error)) {
      console.error(
        '[admin.style-defaults] load effect default links failed:',
        describeSupabaseError(error),
      );
    }
    return {};
  }

  const grouped: Record<string, EffectStyleDefaultLinkRow[]> = {};
  for (const row of (data ?? []) as EffectStyleDefaultLinkRow[]) {
    grouped[row.firework_effect_id] ??= [];
    grouped[row.firework_effect_id]?.push(row);
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([ownerId, rows]) => [ownerId, mapOwnerLinks(rows)]),
  );
}

export async function loadFireworkStyleDefaultLinkMap(
  supabase: ServerClient,
  fireworkIds: readonly string[],
): Promise<Record<string, AdminStyleDefaultLinkMap>> {
  if (fireworkIds.length === 0) return {};
  const { data, error } = await supabase
    .from('firework_style_default_links')
    .select(
      'firework_id, kind, style_default_id, style_default:firework_style_defaults!firework_style_default_links_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived)',
    )
    .in('firework_id', [...fireworkIds]);

  if (error) {
    if (!isMissingStyleDefaultSchemaError(error)) {
      console.error(
        '[admin.style-defaults] load firework default links failed:',
        describeSupabaseError(error),
      );
    }
    return {};
  }

  const grouped: Record<string, FireworkStyleDefaultLinkRow[]> = {};
  for (const row of (data ?? []) as FireworkStyleDefaultLinkRow[]) {
    grouped[row.firework_id] ??= [];
    grouped[row.firework_id]?.push(row);
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([ownerId, rows]) => [ownerId, mapOwnerLinks(rows)]),
  );
}
