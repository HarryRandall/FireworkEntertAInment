'use server';

/** Admin firework/product actions for product metadata and shot sequences. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  invalidateAdminCatalogueCache,
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  requirePermission,
} from '@/lib/admin.server';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

type Result = { ok: true } | { ok: false; error: string };

const ProductKindSchema = z.enum([
  'single_shot',
  'multi_shot',
  'assortment',
  'cake',
  'rack',
  'shell_kit',
  'fountain',
  'other',
]);

const FireworkProductSchema = z.object({
  id: z.string().uuid(),
  partNumber: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  manufacturer: z.string().trim().max(120).optional().nullable(),
  fireworkType: z.string().trim().max(80).optional().nullable(),
  productKind: ProductKindSchema,
  durationSeconds: z.coerce.number().min(0).max(3600).optional().nullable(),
  description: z.string().trim().max(1200).optional().nullable(),
});

const ShotSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  shotIndex: z.coerce.number().int().min(1).max(1000),
  timeOffsetSeconds: z.coerce.number().min(0).max(3600),
  panDegrees: z.coerce.number().int().min(-180).max(180),
  tiltDegrees: z.coerce.number().int().min(-90).max(90),
  caliber: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const DeleteShotSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

async function refreshFireworkAdmin(productId: string) {
  await invalidateAdminCatalogueCache();
  await invalidateAdminEffectsCache();
  await invalidateAdminFireworksCache(productId);
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/catalogue');
  revalidatePath('/admin/fireworks');
  revalidatePath(`/admin/fireworks/${productId}`);
  revalidatePath('/admin/effects');
}

export async function updateFireworkProduct(
  input: z.infer<typeof FireworkProductSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = FireworkProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('catalogue_items')
    .update({
      part_number: parsed.data.partNumber,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer || null,
      firework_type: parsed.data.fireworkType || null,
      duration_seconds: parsed.data.durationSeconds ?? null,
      description: parsed.data.description || null,
    })
    .eq('id', parsed.data.id);

  if (error) return { ok: false, error: error.message };
  await refreshFireworkAdmin(parsed.data.id);
  return { ok: true };
}

async function ensureMultishotForCatalogueItem(
  supabase: ReturnType<typeof createClient>,
  catalogueItemId: string,
) {
  const { data: item, error } = await supabase
    .from('catalogue_items')
    .select(
      'id, part_number, name, description, duration_seconds, metadata, firework_id, multishot_id',
    )
    .eq('id', catalogueItemId)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!item) return { data: null, error: new Error('Catalogue item was not found.') };
  if (item.multishot_id) return { data: item.multishot_id, error: null };

  const multishotId = item.id;
  const { error: insertError } = await supabase.from('multishots').insert({
    id: multishotId,
    slug: item.part_number,
    name: item.name,
    description: item.description,
    duration_seconds: item.duration_seconds,
    shot_count: item.firework_id ? 1 : 0,
    metadata: item.metadata ?? {},
  });
  if (insertError) return { data: null, error: insertError };

  if (item.firework_id) {
    const { error: firstShotError } = await supabase.from('multishot_fireworks').insert({
      multishot_id: multishotId,
      firework_id: item.firework_id,
      sequence_index: 1,
      time_offset_seconds: 0,
      pan_degrees: 0,
      tilt_degrees: 0,
    });
    if (firstShotError) return { data: null, error: firstShotError };
  }

  const { error: updateError } = await supabase
    .from('catalogue_items')
    .update({
      catalogue_item_kind: 'multishot',
      firework_id: null,
      multishot_id: multishotId,
    })
    .eq('id', catalogueItemId);

  if (updateError) return { data: null, error: updateError };
  return { data: multishotId, error: null };
}

export async function upsertProductShot(input: z.infer<typeof ShotSchema>): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = ShotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data: variant, error: variantError } = await supabase
    .from('fireworks')
    .select('id')
    .eq('id', parsed.data.variantId)
    .maybeSingle();

  if (variantError) return { ok: false, error: variantError.message };
  if (!variant) return { ok: false, error: 'Selected firework was not found.' };

  const multishot = await ensureMultishotForCatalogueItem(supabase, parsed.data.productId);
  if (multishot.error || !multishot.data) {
    return { ok: false, error: multishot.error?.message ?? 'Could not prepare multishot.' };
  }

  const payload = {
    multishot_id: multishot.data,
    firework_id: parsed.data.variantId,
    sequence_index: parsed.data.shotIndex,
    time_offset_seconds: parsed.data.timeOffsetSeconds,
    pan_degrees: parsed.data.panDegrees,
    tilt_degrees: parsed.data.tiltDegrees,
    caliber: parsed.data.caliber || null,
    notes: parsed.data.notes || null,
  };

  const query = parsed.data.id
    ? supabase.from('multishot_fireworks').update(payload).eq('id', parsed.data.id)
    : supabase.from('multishot_fireworks').insert(payload);
  const { error } = await query;

  if (error) return { ok: false, error: error.message };
  await refreshFireworkAdmin(parsed.data.productId);
  return { ok: true };
}

export async function deleteProductShot(input: z.infer<typeof DeleteShotSchema>): Promise<Result> {
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
    .eq('multishot_id', parsed.data.productId);

  if (error) return { ok: false, error: error.message };
  await refreshFireworkAdmin(parsed.data.productId);
  return { ok: true };
}
