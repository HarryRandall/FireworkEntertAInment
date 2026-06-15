'use server';

/** Admin multishot actions: compose existing fireworks onto a timeline. A
 *  multishot only places fireworks (time + aim); it never alters their look. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  invalidateAdminCatalogueCache,
  invalidateAdminMultishotsCache,
  requirePermission,
} from '@/lib/admin.server';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const CreateMultishotSchema = z.object({
  name: z.string().trim().min(1).max(180),
});

const UpdateMultishotSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  durationSeconds: z.coerce.number().min(0).max(3600).optional().nullable(),
});

const ShotSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  multishotId: z.string().uuid(),
  fireworkId: z.string().uuid(),
  sequenceIndex: z.coerce.number().int().min(1).max(2000),
  timeOffsetSeconds: z.coerce.number().min(0).max(3600),
  panDegrees: z.coerce.number().int().min(-180).max(180),
  tiltDegrees: z.coerce.number().int().min(-90).max(90),
  launchPositionIndex: z.coerce.number().int().min(0).max(2),
  caliber: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
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

async function refresh(multishotId?: string) {
  await invalidateAdminMultishotsCache(multishotId);
  await invalidateAdminCatalogueCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/multishots');
  if (multishotId) revalidatePath(`/admin/multishots/${multishotId}`);
  revalidatePath('/admin/catalogue');
}

async function syncShotCount(supabase: ReturnType<typeof createClient>, multishotId: string) {
  const { count } = await supabase
    .from('multishot_fireworks')
    .select('id', { count: 'exact', head: true })
    .eq('multishot_id', multishotId);
  await supabase
    .from('multishots')
    .update({ shot_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', multishotId);
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
  await refresh(data.id);
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
  const { error } = await supabase
    .from('multishots')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      duration_seconds: parsed.data.durationSeconds ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id);

  if (error) return { ok: false, error: error.message };
  await refresh(parsed.data.id);
  return { ok: true };
}

export async function upsertMultishotShot(input: z.infer<typeof ShotSchema>): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = ShotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());

  const { data: firework, error: fireworkError } = await supabase
    .from('fireworks')
    .select('id')
    .eq('id', parsed.data.fireworkId)
    .maybeSingle();
  if (fireworkError) return { ok: false, error: fireworkError.message };
  if (!firework) return { ok: false, error: 'Selected firework was not found.' };

  const payload = {
    multishot_id: parsed.data.multishotId,
    firework_id: parsed.data.fireworkId,
    sequence_index: parsed.data.sequenceIndex,
    time_offset_seconds: parsed.data.timeOffsetSeconds,
    pan_degrees: parsed.data.panDegrees,
    tilt_degrees: parsed.data.tiltDegrees,
    position_override_json: { launchPositionIndex: parsed.data.launchPositionIndex },
    caliber: parsed.data.caliber || null,
    notes: parsed.data.notes || null,
  };

  const query = parsed.data.id
    ? supabase.from('multishot_fireworks').update(payload).eq('id', parsed.data.id)
    : supabase.from('multishot_fireworks').insert(payload);
  const { error } = await query;
  if (error) return { ok: false, error: error.message };

  await syncShotCount(supabase, parsed.data.multishotId);
  await refresh(parsed.data.multishotId);
  return { ok: true };
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

  await syncShotCount(supabase, parsed.data.multishotId);
  await refresh(parsed.data.multishotId);
  return { ok: true };
}
