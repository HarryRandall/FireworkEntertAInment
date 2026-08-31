'use server';

/** Admin multishot actions: compose existing fireworks onto a timeline. A
 *  multishot only places fireworks (time + aim); it never alters their look. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  getAdminMultishotCacheKey,
  invalidateAdminCatalogueCache,
  invalidateAdminMultishotsCache,
  requirePermission,
} from '@/lib/admin.server';
import {
  MULTISHOT_CALIBER_MAX_LENGTH,
  MULTISHOT_DESCRIPTION_MAX_LENGTH,
  MULTISHOT_MAX_DURATION_SECONDS,
  MULTISHOT_MAX_SHOT_COUNT,
  MULTISHOT_MAX_TRACK_COUNT,
  MULTISHOT_NAME_MAX_LENGTH,
  MULTISHOT_NOTES_MAX_LENGTH,
  MULTISHOT_PAN_LIMIT_DEGREES,
  MULTISHOT_TILT_LIMIT_DEGREES,
} from '@/lib/admin/multishot-constraints';
import { MIN_PRODUCT_DURATION_SECONDS } from '@/lib/cue-overlap.server';
import { deleteCachedKeys } from '@/lib/server-cache';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type UpsertShotResult = { ok: true; id: string } | { ok: false; error: string };
type DerivedMultishotState =
  | { ok: true; minimumDurationSeconds: number; shotCount: number }
  | { ok: false; error: string };

type DurationShotRow = {
  time_offset_seconds: number | string | null;
  fireworks:
    | {
        duration_seconds: number | string | null;
        catalogue_items: Array<{ duration_seconds: number | string | null }> | null;
      }
    | Array<{
        duration_seconds: number | string | null;
        catalogue_items: Array<{ duration_seconds: number | string | null }> | null;
      }>
    | null;
};

const DERIVED_SHOT_PAGE_SIZE = 500;

const CreateMultishotSchema = z.object({
  name: z.string().trim().min(1).max(MULTISHOT_NAME_MAX_LENGTH),
});

const UpdateMultishotSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(MULTISHOT_NAME_MAX_LENGTH),
  description: z.string().trim().max(MULTISHOT_DESCRIPTION_MAX_LENGTH).optional().nullable(),
  durationSeconds: z.coerce
    .number()
    .min(0)
    .max(MULTISHOT_MAX_DURATION_SECONDS)
    .optional()
    .nullable(),
});

const ShotSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  multishotId: z.string().uuid(),
  fireworkId: z.string().uuid(),
  sequenceIndex: z.coerce.number().int().min(1).max(MULTISHOT_MAX_SHOT_COUNT),
  timelineTrackIndex: z.coerce
    .number()
    .int()
    .min(0)
    .max(MULTISHOT_MAX_TRACK_COUNT - 1),
  timeOffsetSeconds: z.coerce.number().min(0).max(MULTISHOT_MAX_DURATION_SECONDS),
  panDegrees: z.coerce
    .number()
    .int()
    .min(-MULTISHOT_PAN_LIMIT_DEGREES)
    .max(MULTISHOT_PAN_LIMIT_DEGREES),
  tiltDegrees: z.coerce
    .number()
    .int()
    .min(-MULTISHOT_TILT_LIMIT_DEGREES)
    .max(MULTISHOT_TILT_LIMIT_DEGREES),
  launchPositionIndex: z.coerce.number().int().min(0).max(2),
  caliber: z.string().trim().max(MULTISHOT_CALIBER_MAX_LENGTH).optional().nullable(),
  notes: z.string().trim().max(MULTISHOT_NOTES_MAX_LENGTH).optional().nullable(),
});

const DeleteShotSchema = z.object({
  id: z.string().uuid(),
  multishotId: z.string().uuid(),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstJoinedFirework(value: DurationShotRow['fireworks']) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function deriveMultishotState(
  supabase: ReturnType<typeof createClient>,
  multishotId: string,
): Promise<DerivedMultishotState> {
  const shots: DurationShotRow[] = [];
  for (let from = 0; from < MULTISHOT_MAX_SHOT_COUNT; from += DERIVED_SHOT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('multishot_fireworks')
      .select('time_offset_seconds, fireworks(duration_seconds, catalogue_items(duration_seconds))')
      .eq('multishot_id', multishotId)
      .order('sequence_index', { ascending: true })
      .range(from, from + DERIVED_SHOT_PAGE_SIZE - 1);
    if (error) return { ok: false, error: error.message };

    const page = (data ?? []) as unknown as DurationShotRow[];
    shots.push(...page);
    if (page.length < DERIVED_SHOT_PAGE_SIZE) break;
  }

  let maximumEndSeconds = 0;
  for (const shot of shots) {
    const firework = firstJoinedFirework(shot.fireworks);
    const catalogueDurations = (firework?.catalogue_items ?? [])
      .map((item) => finiteNumber(item.duration_seconds))
      .filter((duration): duration is number => duration !== null);
    const productDuration = Math.max(
      MIN_PRODUCT_DURATION_SECONDS,
      finiteNumber(firework?.duration_seconds) ?? 0,
      ...catalogueDurations,
    );
    const endSeconds = (finiteNumber(shot.time_offset_seconds) ?? 0) + productDuration;
    maximumEndSeconds = Math.max(maximumEndSeconds, endSeconds);
  }

  return {
    ok: true,
    minimumDurationSeconds: Math.ceil(maximumEndSeconds * 100) / 100,
    shotCount: shots.length,
  };
}

async function resynchroniseMultishotDerivedState(
  supabase: ReturnType<typeof createClient>,
  multishotId: string,
): Promise<Result> {
  const { data, error } = await supabase.rpc('sync_multishot_derived_state', {
    p_multishot_id: multishotId,
  });
  if (error) return { ok: false, error: error.message };
  const payload =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  if (!payload || payload.ok !== true) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : 'Could not synchronise multishot timing.';
    return { ok: false, error: message };
  }
  return { ok: true };
}

async function refreshMultishotCatalogue(multishotId?: string) {
  await invalidateAdminMultishotsCache(multishotId);
  await invalidateAdminCatalogueCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/multishots');
  if (multishotId) revalidatePath(`/admin/multishots/${multishotId}`);
  revalidatePath('/admin/catalogue');
}

async function refreshMultishotDetail(multishotId: string) {
  await deleteCachedKeys([getAdminMultishotCacheKey(multishotId)]);
  revalidatePath(`/admin/multishots/${multishotId}`);
}

/** Create an empty multishot; a catalogue row is auto-created by trigger. */
export async function createMultishot(
  input: z.infer<typeof CreateMultishotSchema>,
): Promise<CreateResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = CreateMultishotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const baseSlug = slugify(parsed.data.name) || 'multishot';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase
    .from('multishots')
    .insert({ slug, name: parsed.data.name, shot_count: 0 })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not create multishot.' };
  await refreshMultishotCatalogue(data.id);
  return { ok: true, id: data.id };
}

export async function updateMultishot(
  input: z.infer<typeof UpdateMultishotSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = UpdateMultishotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const derived = await deriveMultishotState(supabase, parsed.data.id);
  if (!derived.ok) return derived;
  if (derived.minimumDurationSeconds > MULTISHOT_MAX_DURATION_SECONDS) {
    return {
      ok: false,
      error: `The final shot ends at ${derived.minimumDurationSeconds} seconds, above the supported ${MULTISHOT_MAX_DURATION_SECONDS} second duration.`,
    };
  }

  const requestedDuration = parsed.data.durationSeconds ?? null;
  if (
    requestedDuration !== null &&
    requestedDuration + Number.EPSILON < derived.minimumDurationSeconds
  ) {
    return {
      ok: false,
      error: `Duration must be at least ${derived.minimumDurationSeconds} seconds to include every shot.`,
    };
  }
  const durationSeconds =
    requestedDuration ??
    (derived.minimumDurationSeconds > 0 ? derived.minimumDurationSeconds : null);

  const { data, error } = await supabase
    .from('multishots')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      duration_seconds: durationSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'That multishot was not found.' };
  await refreshMultishotCatalogue(parsed.data.id);
  return { ok: true };
}

export async function upsertMultishotShot(
  input: z.infer<typeof ShotSchema>,
): Promise<UpsertShotResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = ShotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());

  let nextCaliber = parsed.data.caliber || null;
  let catalogueChanged = !parsed.data.id;
  let shouldValidateFirework = !parsed.data.id;

  if (parsed.data.id) {
    const { data: existingShot, error: existingShotError } = await supabase
      .from('multishot_fireworks')
      .select('firework_id, sequence_index, time_offset_seconds, caliber')
      .eq('id', parsed.data.id)
      .eq('multishot_id', parsed.data.multishotId)
      .maybeSingle();
    if (existingShotError) return { ok: false, error: existingShotError.message };
    if (!existingShot) return { ok: false, error: 'That shot was not found in this multishot.' };

    if (parsed.data.caliber === undefined) nextCaliber = existingShot.caliber;
    shouldValidateFirework = existingShot.firework_id !== parsed.data.fireworkId;
    catalogueChanged =
      shouldValidateFirework ||
      existingShot.sequence_index !== parsed.data.sequenceIndex ||
      Number(existingShot.time_offset_seconds) !== parsed.data.timeOffsetSeconds ||
      existingShot.caliber !== nextCaliber;
  }

  if (shouldValidateFirework) {
    const { data: firework, error: fireworkError } = await supabase
      .from('fireworks')
      .select('id')
      .eq('id', parsed.data.fireworkId)
      .maybeSingle();
    if (fireworkError) return { ok: false, error: fireworkError.message };
    if (!firework) return { ok: false, error: 'Selected firework was not found.' };
  }

  const payload = {
    multishot_id: parsed.data.multishotId,
    firework_id: parsed.data.fireworkId,
    sequence_index: parsed.data.sequenceIndex,
    timeline_track_index: parsed.data.timelineTrackIndex,
    time_offset_seconds: parsed.data.timeOffsetSeconds,
    pan_degrees: parsed.data.panDegrees,
    tilt_degrees: parsed.data.tiltDegrees,
    // A multishot fires from a single mortar; per-shot aim is pan/tilt only.
    position_override_json: { launchPositionIndex: parsed.data.launchPositionIndex },
    caliber: nextCaliber,
    notes: parsed.data.notes || null,
  };

  const query = parsed.data.id
    ? supabase
        .from('multishot_fireworks')
        .update(payload)
        .eq('id', parsed.data.id)
        .eq('multishot_id', parsed.data.multishotId)
        .select('id')
    : supabase.from('multishot_fireworks').insert(payload).select('id');
  const { data, error } = await query.maybeSingle();
  if (error) return { ok: false, error: error.message };
  const id = data?.id as string | undefined;
  if (!id) return { ok: false, error: 'Could not save shot.' };

  const syncResult = await resynchroniseMultishotDerivedState(supabase, parsed.data.multishotId);
  if (!syncResult.ok) return syncResult;
  if (catalogueChanged) {
    await refreshMultishotCatalogue(parsed.data.multishotId);
  } else {
    await refreshMultishotDetail(parsed.data.multishotId);
  }
  return { ok: true, id };
}

export async function deleteMultishotShot(
  input: z.infer<typeof DeleteShotSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = DeleteShotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('multishot_fireworks')
    .delete()
    .eq('id', parsed.data.id)
    .eq('multishot_id', parsed.data.multishotId);
  if (error) return { ok: false, error: error.message };

  const syncResult = await resynchroniseMultishotDerivedState(supabase, parsed.data.multishotId);
  if (!syncResult.ok) return syncResult;
  await refreshMultishotCatalogue(parsed.data.multishotId);
  return { ok: true };
}
