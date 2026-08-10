import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type {
  AdminMultishotDetail,
  AdminMultishotFireworkOption,
  AdminMultishotShot,
  AdminMultishotSummary,
} from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import {
  resolveFireworkPreviewImage,
  type FireworkPreviewImageRelation,
} from '@/lib/firework-preview-image';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminMultishotCacheKey,
  getAdminMultishotsCacheKey,
} from './cache-keys';
import { buildEffectPreview } from './effect-preview';
import { requirePermission } from './current-user.server';
import { getServerClient } from './supabase';

type FireworkLite = {
  id: string;
  slug: string;
  name: string;
  primary_color: string | null;
  firework_effects: { name: string } | { name: string }[] | null;
};

type MultishotShotRow = {
  id: string;
  sequence_index: number;
  timeline_track_index: number;
  time_offset_seconds: number | string | null;
  pan_degrees: number | null;
  tilt_degrees: number | null;
  position_override_json: Json | null;
  caliber: string | null;
  notes: string | null;
  firework_id: string | null;
  fireworks: FireworkLite | FireworkLite[] | null;
};

type MultishotRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_seconds: number | string | null;
  shot_count: number;
  updated_at: string;
  multishot_fireworks?: MultishotShotRow[] | null;
  firework_preview_images?: FireworkPreviewImageRelation;
};

const SHOT_SELECT =
  'id, sequence_index, timeline_track_index, time_offset_seconds, pan_degrees, tilt_degrees, position_override_json, caliber, notes, firework_id, fireworks (id, slug, name, primary_color, firework_effects (name))';

function firstFirework(
  value: FireworkLite | FireworkLite[] | null | undefined,
): FireworkLite | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function firstEffectName(value: FireworkLite['firework_effects']): string | null {
  if (!value) return null;
  const effect = Array.isArray(value) ? value[0] : value;
  return effect?.name ?? null;
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function launchPositionFromOverride(value: Json | null): number {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const raw = (value as Record<string, unknown>).launchPositionIndex;
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(0, Math.min(2, Math.floor(n)));
  }
  return 0;
}

function previewFromShots(rows: MultishotShotRow[]): ReturnType<typeof buildEffectPreview> {
  const palette: string[] = [];
  for (const row of rows) {
    const firework = firstFirework(row.fireworks);
    if (firework?.primary_color && !palette.includes(firework.primary_color)) {
      palette.push(firework.primary_color);
    }
    if (palette.length >= 4) break;
  }
  return buildEffectPreview({ colorPalette: palette } as Json, { name: 'Multishot' });
}

function mapSummary(row: MultishotRow): AdminMultishotSummary {
  const shots = [...(row.multishot_fireworks ?? [])].sort(
    (a, b) => a.sequence_index - b.sequence_index,
  );
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    durationSeconds: numberOrNull(row.duration_seconds),
    shotCount: row.shot_count ?? shots.length,
    preview: previewFromShots(shots),
    ...resolveFireworkPreviewImage(row.firework_preview_images),
    updatedAt: row.updated_at,
  };
}

/** Lists every multishot composition for the admin table. */
export async function listMultishots(): Promise<AdminMultishotSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const cacheKey = getAdminMultishotsCacheKey();
  const cached = await getCachedJson<AdminMultishotSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('multishots')
    .select(
      `id, slug, name, description, duration_seconds, shot_count, updated_at,
       firework_preview_images(source_revision, renderer_version, storage_path),
       multishot_fireworks (${SHOT_SELECT})`,
    )
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[admin.multishots] listMultishots failed:', error);
    return [];
  }

  const mapped = ((data ?? []) as MultishotRow[]).map(mapSummary);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

/** Fireworks selectable as multishot shots. */
export async function listFireworkOptions(): Promise<AdminMultishotFireworkOption[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('fireworks')
    .select('id, slug, name, primary_color, firework_effects (name)')
    .order('name', { ascending: true });
  if (error) {
    console.error('[admin.multishots] listFireworkOptions failed:', error);
    return [];
  }
  return ((data ?? []) as FireworkLite[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    primaryColor: row.primary_color,
    effectName: firstEffectName(row.firework_effects),
  }));
}

/** One multishot with its ordered shots and the firework picker options. */
export async function getMultishotById(multishotId: string): Promise<AdminMultishotDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const cacheKey = getAdminMultishotCacheKey(multishotId);
  const cached = await getCachedJson<AdminMultishotDetail>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const [multishotResult, fireworkOptions] = await Promise.all([
    supabase
      .from('multishots')
      .select(
        `id, slug, name, description, duration_seconds, shot_count, updated_at,
         firework_preview_images(source_revision, renderer_version, storage_path),
         multishot_fireworks (${SHOT_SELECT})`,
      )
      .eq('id', multishotId)
      .maybeSingle(),
    listFireworkOptions(),
  ]);

  if (multishotResult.error) {
    console.error('[admin.multishots] getMultishotById failed:', multishotResult.error);
    return null;
  }
  if (!multishotResult.data) return null;

  const row = multishotResult.data as MultishotRow;
  const shots: AdminMultishotShot[] = [...(row.multishot_fireworks ?? [])]
    .sort((a, b) => a.sequence_index - b.sequence_index)
    .map((shot) => {
      const firework = firstFirework(shot.fireworks);
      return {
        id: shot.id,
        sequenceIndex: shot.sequence_index,
        timelineTrackIndex: Math.max(0, Math.floor(shot.timeline_track_index ?? 0)),
        timeOffsetSeconds: numberOrNull(shot.time_offset_seconds) ?? 0,
        panDegrees: shot.pan_degrees ?? 0,
        tiltDegrees: shot.tilt_degrees ?? 0,
        launchPositionIndex: launchPositionFromOverride(shot.position_override_json),
        caliber: shot.caliber,
        notes: shot.notes,
        fireworkId: shot.firework_id ?? firework?.id ?? null,
        fireworkName: firework?.name ?? null,
        fireworkSlug: firework?.slug ?? null,
        primaryColor: firework?.primary_color ?? null,
        effectName: firstEffectName(firework?.firework_effects ?? null),
      };
    });

  const detail: AdminMultishotDetail = {
    ...mapSummary(row),
    shots,
    fireworkOptions,
  };
  await setCachedJson(cacheKey, detail, ADMIN_CACHE_TTL_SECONDS);
  return detail;
}
