"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requirePermission } from "@/lib/admin.server";

type Result = { ok: true } | { ok: false; error: string };

const ProductInput = z.object({
  partNumber: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  manufacturer: z.string().trim().max(120).optional(),
  fireworkType: z.string().trim().max(80).optional(),
  durationSeconds: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "" || v === null) return null;
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : null;
    }),
});

const UpdateProduct = ProductInput.extend({ id: z.string().uuid() });
const DeleteProduct = z.object({ id: z.string().uuid() });

export type ProductInputType = z.infer<typeof ProductInput>;

export async function createProduct(input: ProductInputType): Promise<Result> {
  if (!(await requirePermission("admin.manage_catalogue"))) {
    return { ok: false, error: "Not permitted." };
  }
  const parsed = ProductInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("products").insert({
    part_number: parsed.data.partNumber,
    name: parsed.data.name,
    manufacturer: parsed.data.manufacturer || null,
    subtype: parsed.data.fireworkType || null,
    duration_seconds: parsed.data.durationSeconds,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/catalogue");
  return { ok: true };
}

export async function updateProduct(input: z.infer<typeof UpdateProduct>): Promise<Result> {
  if (!(await requirePermission("admin.manage_catalogue"))) {
    return { ok: false, error: "Not permitted." };
  }
  const parsed = UpdateProduct.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("products")
    .update({
      part_number: parsed.data.partNumber,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer || null,
      subtype: parsed.data.fireworkType || null,
      duration_seconds: parsed.data.durationSeconds,
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/catalogue");
  return { ok: true };
}

export async function deleteProduct(input: z.infer<typeof DeleteProduct>): Promise<Result> {
  if (!(await requirePermission("admin.manage_catalogue"))) {
    return { ok: false, error: "Not permitted." };
  }
  const parsed = DeleteProduct.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("products").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/catalogue");
  return { ok: true };
}
