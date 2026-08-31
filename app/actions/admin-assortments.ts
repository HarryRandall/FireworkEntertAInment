'use server';

/** Admin write actions for in-store assortments, mirroring the shape of app/actions/admin-multishots.ts. */

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/lib/admin/current-user.server';
import {
  searchCatalogueItemOptions,
  type AdminCatalogueItemOption,
} from '@/lib/admin/assortments.server';
import { slugifyTitle } from '@/lib/show-domain';

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

/** Server action wrapper so the client-side member picker can search the catalogue without a dedicated API route. */
export async function searchCatalogueItems(query: string): Promise<AdminCatalogueItemOption[]> {
  return searchCatalogueItemOptions(query);
}

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

const CreateAssortmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function createAssortment(
  input: z.infer<typeof CreateAssortmentSchema>,
): Promise<CreateResult> {
  const profile = await requirePermission('admin.manage_assortments');
  if (!profile) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = CreateAssortmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const baseSlug = slugifyTitle(parsed.data.name) || 'assortment';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase
    .from('assortments')
    .insert({
      slug,
      name: parsed.data.name,
      price_cents: 0,
      is_active: false,
      created_by: profile.id,
    })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not create assortment.' };
  revalidatePath('/admin/assortments');
  return { ok: true, id: data.id };
}

type EnsurePublicLinkResult = { ok: true; publicToken: string } | { ok: false; error: string };

export async function ensureAssortmentPublicLink(
  assortmentId: string,
): Promise<EnsurePublicLinkResult> {
  if (!(await requirePermission('admin.manage_assortments'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = z.string().uuid().safeParse(assortmentId);
  if (!parsed.success) return { ok: false, error: 'Invalid assortment.' };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc('ensure_assortment_public_link', {
    p_assortment_id: parsed.data,
  });
  const result = data as { publicToken?: unknown } | null;
  if (error || typeof result?.publicToken !== 'string') {
    console.error('[admin/assortments] public link creation failed:', error);
    return { ok: false, error: 'The reusable QR link could not be created.' };
  }

  await refreshAssortmentDetail(parsed.data);
  return { ok: true, publicToken: result.publicToken };
}

const UpdateAssortmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  priceCents: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

export async function updateAssortment(
  input: z.infer<typeof UpdateAssortmentSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_assortments'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = UpdateAssortmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('assortments')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      price_cents: parsed.data.priceCents,
      is_active: parsed.data.isActive,
    })
    .eq('id', parsed.data.id);

  if (error) return { ok: false, error: error.message };
  await refreshAssortmentDetail(parsed.data.id);
  return { ok: true };
}

const UpsertAssortmentItemSchema = z.object({
  assortmentId: z.string().uuid(),
  catalogueItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(999),
  sortOrder: z.coerce.number().int().min(0),
});

export async function upsertAssortmentItem(
  input: z.infer<typeof UpsertAssortmentItemSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_assortments'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = UpsertAssortmentItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data: catalogueItem, error: catalogueError } = await supabase
    .from('catalogue_items')
    .select('id')
    .eq('id', parsed.data.catalogueItemId)
    .maybeSingle();
  if (catalogueError || !catalogueItem) {
    return { ok: false, error: 'That catalogue item could not be found.' };
  }

  const { error } = await supabase.from('assortment_items').upsert(
    {
      assortment_id: parsed.data.assortmentId,
      catalogue_item_id: parsed.data.catalogueItemId,
      quantity: parsed.data.quantity,
      sort_order: parsed.data.sortOrder,
    },
    { onConflict: 'assortment_id,catalogue_item_id' },
  );

  if (error) return { ok: false, error: error.message };
  await refreshAssortmentDetail(parsed.data.assortmentId);
  return { ok: true };
}

const DeleteAssortmentItemSchema = z.object({
  assortmentId: z.string().uuid(),
  assortmentItemId: z.string().uuid(),
});

export async function deleteAssortmentItem(
  input: z.infer<typeof DeleteAssortmentItemSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_assortments'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = DeleteAssortmentItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('assortment_items')
    .delete()
    .eq('id', parsed.data.assortmentItemId)
    .eq('assortment_id', parsed.data.assortmentId);

  if (error) return { ok: false, error: error.message };
  await refreshAssortmentDetail(parsed.data.assortmentId);
  return { ok: true };
}

async function refreshAssortmentDetail(assortmentId: string) {
  revalidatePath('/admin/assortments');
  revalidatePath(`/admin/assortments/${assortmentId}`);
}
