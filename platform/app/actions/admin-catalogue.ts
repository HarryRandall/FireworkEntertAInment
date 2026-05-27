'use server';

/**
 * Admin catalogue server actions: create / update / delete entries
 * in the `products` catalogue table. All actions are gated by the
 * `admin.manage_catalogue` RBAC permission.
 */

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
const MAX_PRODUCT_DURATION_SECONDS = 60 * 60;

function clampProductDurationSeconds(value: number): number {
  return Math.min(MAX_PRODUCT_DURATION_SECONDS, Math.max(0, value));
}

const ProductInput = z.object({
  partNumber: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  manufacturer: z.string().trim().max(120).optional(),
  fireworkType: z.string().trim().max(80).optional(),
  durationSeconds: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '' || v === null) return null;
      const n = typeof v === 'string' ? Number(v) : v;
      return Number.isFinite(n) ? clampProductDurationSeconds(n) : null;
    }),
});

const UpdateProduct = ProductInput.extend({ id: z.string().uuid() });
const DeleteProduct = z.object({ id: z.string().uuid() });

export type ProductInputType = z.infer<typeof ProductInput>;

/** Insert a new row in the `products` catalogue (RBAC: `admin.manage_catalogue`). */
export async function createProduct(input: ProductInputType): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = ProductInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from('products').insert({
    part_number: parsed.data.partNumber,
    name: parsed.data.name,
    manufacturer: parsed.data.manufacturer || null,
    subtype: parsed.data.fireworkType || null,
    duration_seconds: parsed.data.durationSeconds,
  });
  if (error) return { ok: false, error: error.message };
  await invalidateAdminCatalogueCache();
  await invalidateAdminEffectsCache();
  await invalidateAdminFireworksCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/catalogue');
  revalidatePath('/admin/effects');
  revalidatePath('/admin/fireworks');
  return { ok: true };
}

/** Update an existing `products` row (RBAC: `admin.manage_catalogue`). */
export async function updateProduct(input: z.infer<typeof UpdateProduct>): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = UpdateProduct.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('products')
    .update({
      part_number: parsed.data.partNumber,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer || null,
      subtype: parsed.data.fireworkType || null,
      duration_seconds: parsed.data.durationSeconds,
    })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: error.message };
  await invalidateAdminCatalogueCache();
  await invalidateAdminEffectsCache();
  await invalidateAdminFireworksCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/catalogue');
  revalidatePath('/admin/effects');
  revalidatePath('/admin/fireworks');
  return { ok: true };
}

/** Delete a `products` row by id (RBAC: `admin.manage_catalogue`). */
export async function deleteProduct(input: z.infer<typeof DeleteProduct>): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = DeleteProduct.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from('products').delete().eq('id', parsed.data.id);
  if (error) return { ok: false, error: error.message };
  await invalidateAdminCatalogueCache();
  await invalidateAdminEffectsCache();
  await invalidateAdminFireworksCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/catalogue');
  revalidatePath('/admin/effects');
  revalidatePath('/admin/fireworks');
  return { ok: true };
}
