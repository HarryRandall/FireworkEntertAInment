'use server';

/**
 * Retailer-owned assortment server actions. Gated on `retailer.manage_assortments`
 * and, for save, further enforced by ownership checks inside the guarded
 * `save_retailer_assortment` RPC (see FIR-166 migration
 * 20260824070000_retailer_owned_assortments.sql).
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/lib/admin.server';

type Result = { ok: true } | { ok: false; error: string };

// The generated Database type doesn't capture that p_assortment_id is
// nullable (Supabase's codegen can't infer function-argument nullability),
// so this narrows the call site the same way lib admin-users.ts does for
// set_user_status.
type SaveAssortmentRpcClient = {
  rpc(
    functionName: 'save_retailer_assortment',
    args: {
      p_assortment_id: string | null;
      p_name: string;
      p_description: string | null;
      p_price_cents: number;
      p_items: { catalogueItemId: string; quantity: number; sortOrder: number }[];
    },
  ): PromiseLike<{ data: string | null; error: { message: string } | null }>;
};

const AssortmentItemSchema = z.object({
  catalogueItemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
});

// Retailer assortments have no draft state — discoverability is physical
// (the QR code lives on the product), so every assortment is active from
// creation. See migration 20260824080000_retire_retailer_assortment_draft_state.
const SaveAssortmentSchema = z.object({
  assortmentId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  priceCents: z.number().int().min(0).max(100_000_00),
  items: z.array(AssortmentItemSchema).min(1).max(50),
});

const DeleteAssortmentSchema = z.object({
  assortmentId: z.string().uuid(),
});

export async function saveRetailerAssortmentAction(
  input: z.infer<typeof SaveAssortmentSchema>,
): Promise<Result> {
  const profile = await requirePermission('retailer.manage_assortments');
  if (!profile) return { ok: false, error: 'Not permitted.' };
  const parsed = SaveAssortmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid assortment input.' };

  const supabase = createClient(await cookies());
  const rpc = supabase as unknown as SaveAssortmentRpcClient;
  const { error } = await rpc.rpc('save_retailer_assortment', {
    p_assortment_id: parsed.data.assortmentId,
    p_name: parsed.data.name,
    p_description: parsed.data.description?.length ? parsed.data.description : null,
    p_price_cents: parsed.data.priceCents,
    p_items: parsed.data.items.map((item, index) => ({
      catalogueItemId: item.catalogueItemId,
      quantity: item.quantity,
      sortOrder: index,
    })),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/retailer-admin/assortments');
  revalidatePath('/retailer-admin');
  return { ok: true };
}

export async function deleteRetailerAssortmentAction(
  input: z.infer<typeof DeleteAssortmentSchema>,
): Promise<Result> {
  const profile = await requirePermission('retailer.manage_assortments');
  if (!profile) return { ok: false, error: 'Not permitted.' };
  const parsed = DeleteAssortmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const supabase = createClient(await cookies());
  const { error, count } = await supabase
    .from('assortments')
    .delete({ count: 'exact' })
    .eq('id', parsed.data.assortmentId)
    .eq('created_by', profile.id);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: 'Assortment not found.' };

  revalidatePath('/retailer-admin/assortments');
  revalidatePath('/retailer-admin');
  return { ok: true };
}
