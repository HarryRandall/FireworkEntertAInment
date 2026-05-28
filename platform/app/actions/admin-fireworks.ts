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
    .from('products')
    .update({
      part_number: parsed.data.partNumber,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer || null,
      subtype: parsed.data.fireworkType || null,
      product_kind: parsed.data.productKind,
      duration_seconds: parsed.data.durationSeconds ?? null,
      description: parsed.data.description || null,
    })
    .eq('id', parsed.data.id);

  if (error) return { ok: false, error: error.message };
  await refreshFireworkAdmin(parsed.data.id);
  return { ok: true };
}

export async function upsertProductShot(input: z.infer<typeof ShotSchema>): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = ShotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data: variant, error: variantError } = await supabase
    .from('firework_variants')
    .select('source_effect_spec_id')
    .eq('id', parsed.data.variantId)
    .maybeSingle();

  if (variantError) return { ok: false, error: variantError.message };
  if (!variant) return { ok: false, error: 'Selected firework variant was not found.' };

  const payload = {
    product_id: parsed.data.productId,
    firework_variant_id: parsed.data.variantId,
    effect_spec_id: variant.source_effect_spec_id,
    shot_index: parsed.data.shotIndex,
    time_offset_seconds: parsed.data.timeOffsetSeconds,
    pan_degrees: parsed.data.panDegrees,
    tilt_degrees: parsed.data.tiltDegrees,
    caliber: parsed.data.caliber || null,
    shot_notes: parsed.data.notes || null,
  };

  const query = parsed.data.id
    ? supabase.from('product_shots').update(payload).eq('id', parsed.data.id)
    : supabase.from('product_shots').insert(payload);
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
    .from('product_shots')
    .delete()
    .eq('id', parsed.data.id)
    .eq('product_id', parsed.data.productId);

  if (error) return { ok: false, error: error.message };
  await refreshFireworkAdmin(parsed.data.productId);
  return { ok: true };
}
