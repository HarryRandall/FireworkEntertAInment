'use server';

/**
 * Admin supplier server actions: create / update / delete rows in
 * `supplier_profiles`. All actions are gated by the
 * `admin.manage_suppliers` RBAC permission.
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { invalidateAdminSuppliersCache, requirePermission } from '@/lib/admin.server';
import { slugifyTitle } from '@/lib/show-domain';

type Result = { ok: true } | { ok: false; error: string };

const SafeWebsiteUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v ?? '')
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Website URL must start with http:// or https://.');

const SupplierInput = z.object({
  name: z.string().trim().min(1).max(160),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v ?? ''),
  phone: z.string().trim().max(40).optional(),
  websiteUrl: SafeWebsiteUrl,
  status: z.enum(['draft', 'active', 'suspended', 'archived']),
});

const UpdateSupplier = SupplierInput.extend({ id: z.string().uuid() });
const DeleteSupplier = z.object({ id: z.string().uuid() });

export type SupplierInputType = z.infer<typeof SupplierInput>;

/** Insert a new `supplier_profiles` row (RBAC: `admin.manage_suppliers`). */
export async function createSupplier(input: SupplierInputType): Promise<Result> {
  if (!(await requirePermission('admin.manage_suppliers'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = SupplierInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from('supplier_profiles').insert({
    name: parsed.data.name,
    slug: `${slugifyTitle(parsed.data.name)}-${crypto.randomUUID().slice(0, 8)}`,
    contact_email: parsed.data.contactEmail || null,
    phone: parsed.data.phone || null,
    website_url: parsed.data.websiteUrl || null,
    status: parsed.data.status,
  });
  if (error) return { ok: false, error: error.message };
  await invalidateAdminSuppliersCache();
  revalidatePath('/admin/suppliers');
  return { ok: true };
}

/** Update an existing `supplier_profiles` row (RBAC: `admin.manage_suppliers`). */
export async function updateSupplier(input: z.infer<typeof UpdateSupplier>): Promise<Result> {
  if (!(await requirePermission('admin.manage_suppliers'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = UpdateSupplier.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const supabase = createClient(await cookies());
  const { data: updatedSupplier, error } = await supabase
    .from('supplier_profiles')
    .update({
      name: parsed.data.name,
      contact_email: parsed.data.contactEmail || null,
      phone: parsed.data.phone || null,
      website_url: parsed.data.websiteUrl || null,
      status: parsed.data.status,
    })
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updatedSupplier) return { ok: false, error: 'Supplier not found.' };
  await invalidateAdminSuppliersCache();
  revalidatePath('/admin/suppliers');
  return { ok: true };
}

/** Delete a `supplier_profiles` row by id (RBAC: `admin.manage_suppliers`). */
export async function deleteSupplier(input: z.infer<typeof DeleteSupplier>): Promise<Result> {
  if (!(await requirePermission('admin.manage_suppliers'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = DeleteSupplier.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const supabase = createClient(await cookies());
  const { data: deletedSupplier, error } = await supabase
    .from('supplier_profiles')
    .delete()
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!deletedSupplier) return { ok: false, error: 'Supplier not found.' };
  await invalidateAdminSuppliersCache();
  revalidatePath('/admin/suppliers');
  return { ok: true };
}
