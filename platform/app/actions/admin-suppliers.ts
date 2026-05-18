"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requirePermission } from "@/lib/admin.server";
import { slugifyTitle } from "@/lib/show-domain";

type Result = { ok: true } | { ok: false; error: string };

const SupplierInput = z.object({
  name: z.string().trim().min(1).max(160),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v ?? ""),
  phone: z.string().trim().max(40).optional(),
  websiteUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v ?? ""),
  status: z.enum(["draft", "active", "suspended", "archived"]),
});

const UpdateSupplier = SupplierInput.extend({ id: z.string().uuid() });
const DeleteSupplier = z.object({ id: z.string().uuid() });

export type SupplierInputType = z.infer<typeof SupplierInput>;

export async function createSupplier(input: SupplierInputType): Promise<Result> {
  if (!(await requirePermission("admin.manage_suppliers"))) {
    return { ok: false, error: "Not permitted." };
  }
  const parsed = SupplierInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("supplier_profiles").insert({
    name: parsed.data.name,
    slug: `${slugifyTitle(parsed.data.name)}-${crypto.randomUUID().slice(0, 8)}`,
    contact_email: parsed.data.contactEmail || null,
    phone: parsed.data.phone || null,
    website_url: parsed.data.websiteUrl || null,
    status: parsed.data.status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/suppliers");
  return { ok: true };
}

export async function updateSupplier(input: z.infer<typeof UpdateSupplier>): Promise<Result> {
  if (!(await requirePermission("admin.manage_suppliers"))) {
    return { ok: false, error: "Not permitted." };
  }
  const parsed = UpdateSupplier.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("supplier_profiles")
    .update({
      name: parsed.data.name,
      contact_email: parsed.data.contactEmail || null,
      phone: parsed.data.phone || null,
      website_url: parsed.data.websiteUrl || null,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/suppliers");
  return { ok: true };
}

export async function deleteSupplier(input: z.infer<typeof DeleteSupplier>): Promise<Result> {
  if (!(await requirePermission("admin.manage_suppliers"))) {
    return { ok: false, error: "Not permitted." };
  }
  const parsed = DeleteSupplier.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("supplier_profiles").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/suppliers");
  return { ok: true };
}
