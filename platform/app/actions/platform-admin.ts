"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUserId } from "@/lib/current-user.server";
import { requirePermission } from "@/lib/platform.server";
import { slugifyTitle } from "@/lib/shows";

const ProfileSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  themePreference: z.enum(["dark", "light", "system"]).default("dark"),
});

const AdminUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(["active", "suspended"]),
  roles: z.array(z.string().uuid()).min(1),
});

const PermissionOverrideSchema = z.object({
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  mode: z.enum(["grant", "deny", "clear"]),
});

const OrganisationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(["customer", "supplier", "internal"]),
  status: z.enum(["active", "suspended", "archived"]),
});

const SupplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  websiteUrl: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(["draft", "active", "suspended", "archived"]),
});

const CatalogueProductSchema = z.object({
  partNumber: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  manufacturer: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  fireworkType: z.string().trim().max(80).optional(),
  durationSeconds: z.coerce.number().min(0).max(60 * 60).optional().or(z.literal("")),
});

const ImportJobSchema = z.object({
  kind: z.enum(["vdl_glossary", "firework_video", "supplier_stock"]),
  sourceName: z.string().trim().min(1).max(180),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(["draft", "queued", "processing", "needs_review", "complete", "failed"]),
  rowCount: z.coerce.number().int().min(0).optional().or(z.literal("")),
});

const IdSchema = z.object({
  id: z.string().uuid(),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form details.";
}

export async function updateProfileAction(
  formData: FormData,
): Promise<void> {
  const parsed = ProfileSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    themePreference: formData.get("themePreference") ?? "dark",
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const userId = await getCurrentUserId();
  if (!userId) return;

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName || null,
      phone: parsed.data.phone || null,
      theme_preference: parsed.data.themePreference,
    })
    .eq("id", userId);
  if (error) {
    console.error("[updateProfileAction] failed:", error);
    return;
  }
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
}

export async function updateAdminUserAction(
  formData: FormData,
): Promise<void> {
  const admin = await requirePermission("admin.manage_users");
  if (!admin) return;

  const parsed = AdminUserSchema.safeParse({
    userId: formData.get("userId"),
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    status: formData.get("status") ?? "active",
    roles: formData.getAll("roles").map(String),
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const supabase = createClient(await cookies());
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName || null,
      phone: parsed.data.phone || null,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.userId);
  if (profileError) {
    console.error("[updateAdminUserAction] profile failed:", profileError);
    return;
  }

  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", parsed.data.userId);
  if (deleteError) {
    console.error("[updateAdminUserAction] delete roles failed:", deleteError);
    return;
  }

  const { error: insertError } = await supabase.from("user_roles").insert(
    parsed.data.roles.map((roleId) => ({
      user_id: parsed.data.userId,
      role_id: roleId,
      assigned_by: admin.id,
    })),
  );
  if (insertError) {
    console.error("[updateAdminUserAction] insert roles failed:", insertError);
    return;
  }

  revalidatePath("/admin/users");
}

export async function setPermissionOverrideAction(
  formData: FormData,
): Promise<void> {
  const admin = await requirePermission("admin.manage_users");
  if (!admin) return;

  const parsed = PermissionOverrideSchema.safeParse({
    userId: formData.get("userId"),
    permissionId: formData.get("permissionId"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const supabase = createClient(await cookies());
  if (parsed.data.mode === "clear") {
    const { error } = await supabase
      .from("user_permission_overrides")
      .delete()
      .eq("user_id", parsed.data.userId)
      .eq("permission_id", parsed.data.permissionId);
    if (error) {
      console.error("[setPermissionOverrideAction] clear failed:", error);
      return;
    }
  } else {
    const { error } = await supabase.from("user_permission_overrides").upsert({
      user_id: parsed.data.userId,
      permission_id: parsed.data.permissionId,
      enabled: parsed.data.mode === "grant",
      assigned_by: admin.id,
    });
    if (error) {
      console.error("[setPermissionOverrideAction] upsert failed:", error);
      return;
    }
  }

  revalidatePath("/admin/users");
}

export async function createOrganisationAction(
  formData: FormData,
): Promise<void> {
  const admin = await requirePermission("admin.manage_organisations");
  if (!admin) return;
  const parsed = OrganisationSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    status: formData.get("status"),
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("organisations").insert({
    name: parsed.data.name,
    slug: `${slugifyTitle(parsed.data.name)}-${crypto.randomUUID().slice(0, 8)}`,
    type: parsed.data.type,
    status: parsed.data.status,
    created_by: admin.id,
  });
  if (error) {
    console.error("[createOrganisationAction] failed:", error);
    return;
  }
  revalidatePath("/admin/organisations");
}

export async function updateOrganisationAction(formData: FormData): Promise<void> {
  if (!(await requirePermission("admin.manage_organisations"))) return;
  const parsed = OrganisationSchema.extend({ id: z.string().uuid() }).safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    type: formData.get("type"),
    status: formData.get("status"),
  });
  if (!parsed.success) return console.error(firstError(parsed.error));
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("organisations")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.id);
  if (error) console.error("[updateOrganisationAction] failed:", error);
  revalidatePath("/admin/organisations");
}

export async function deleteOrganisationAction(formData: FormData): Promise<void> {
  if (!(await requirePermission("admin.manage_organisations"))) return;
  const parsed = IdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return console.error(firstError(parsed.error));
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("organisations")
    .delete()
    .eq("id", parsed.data.id);
  if (error) console.error("[deleteOrganisationAction] failed:", error);
  revalidatePath("/admin/organisations");
}

export async function createSupplierAction(
  formData: FormData,
): Promise<void> {
  if (!(await requirePermission("admin.manage_suppliers"))) {
    return;
  }
  const parsed = SupplierSchema.safeParse({
    name: formData.get("name"),
    contactEmail: formData.get("contactEmail") ?? "",
    phone: formData.get("phone") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    status: formData.get("status") ?? "draft",
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("supplier_profiles").insert({
    name: parsed.data.name,
    slug: `${slugifyTitle(parsed.data.name)}-${crypto.randomUUID().slice(0, 8)}`,
    contact_email: parsed.data.contactEmail || null,
    phone: parsed.data.phone || null,
    website_url: parsed.data.websiteUrl || null,
    status: parsed.data.status,
  });
  if (error) {
    console.error("[createSupplierAction] failed:", error);
    return;
  }
  revalidatePath("/admin/suppliers");
}

export async function updateSupplierAction(formData: FormData): Promise<void> {
  if (!(await requirePermission("admin.manage_suppliers"))) return;
  const parsed = SupplierSchema.extend({ id: z.string().uuid() }).safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    contactEmail: formData.get("contactEmail") ?? "",
    phone: formData.get("phone") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    status: formData.get("status") ?? "draft",
  });
  if (!parsed.success) return console.error(firstError(parsed.error));
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
  if (error) console.error("[updateSupplierAction] failed:", error);
  revalidatePath("/admin/suppliers");
}

export async function deleteSupplierAction(formData: FormData): Promise<void> {
  if (!(await requirePermission("admin.manage_suppliers"))) return;
  const parsed = IdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return console.error(firstError(parsed.error));
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("supplier_profiles")
    .delete()
    .eq("id", parsed.data.id);
  if (error) console.error("[deleteSupplierAction] failed:", error);
  revalidatePath("/admin/suppliers");
}

export async function createCatalogueProductAction(
  formData: FormData,
): Promise<void> {
  if (!(await requirePermission("admin.manage_catalogue"))) {
    return;
  }
  const parsed = CatalogueProductSchema.safeParse({
    partNumber: formData.get("partNumber"),
    name: formData.get("name"),
    manufacturer: formData.get("manufacturer") ?? "",
    category: formData.get("category") ?? "",
    fireworkType: formData.get("fireworkType") ?? "",
    durationSeconds: formData.get("durationSeconds") ?? "",
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const supabase = createClient(await cookies());
  const duration =
    typeof parsed.data.durationSeconds === "number"
      ? parsed.data.durationSeconds
      : null;
  const { error } = await supabase.from("catalogue_products").insert({
    part_number: parsed.data.partNumber,
    name: parsed.data.name,
    manufacturer: parsed.data.manufacturer || null,
    category: parsed.data.category || null,
    firework_type: parsed.data.fireworkType || null,
    duration_seconds: duration,
  });
  if (error) {
    console.error("[createCatalogueProductAction] failed:", error);
    return;
  }
  revalidatePath("/admin/catalogue");
}

export async function updateCatalogueProductAction(formData: FormData): Promise<void> {
  if (!(await requirePermission("admin.manage_catalogue"))) return;
  const parsed = CatalogueProductSchema.extend({ id: z.string().uuid() }).safeParse({
    id: formData.get("id"),
    partNumber: formData.get("partNumber"),
    name: formData.get("name"),
    manufacturer: formData.get("manufacturer") ?? "",
    category: formData.get("category") ?? "",
    fireworkType: formData.get("fireworkType") ?? "",
    durationSeconds: formData.get("durationSeconds") ?? "",
  });
  if (!parsed.success) return console.error(firstError(parsed.error));
  const duration =
    typeof parsed.data.durationSeconds === "number" ? parsed.data.durationSeconds : null;
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("catalogue_products")
    .update({
      part_number: parsed.data.partNumber,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer || null,
      category: parsed.data.category || null,
      firework_type: parsed.data.fireworkType || null,
      duration_seconds: duration,
    })
    .eq("id", parsed.data.id);
  if (error) console.error("[updateCatalogueProductAction] failed:", error);
  revalidatePath("/admin/catalogue");
}

export async function deleteCatalogueProductAction(formData: FormData): Promise<void> {
  if (!(await requirePermission("admin.manage_catalogue"))) return;
  const parsed = IdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return console.error(firstError(parsed.error));
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("catalogue_products")
    .delete()
    .eq("id", parsed.data.id);
  if (error) console.error("[deleteCatalogueProductAction] failed:", error);
  revalidatePath("/admin/catalogue");
}

export async function createImportJobAction(
  formData: FormData,
): Promise<void> {
  const admin = await requirePermission("admin.manage_imports");
  if (!admin) return;
  const parsed = ImportJobSchema.safeParse({
    kind: formData.get("kind"),
    sourceName: formData.get("sourceName"),
    sourceUrl: formData.get("sourceUrl") ?? "",
    status: formData.get("status") ?? "draft",
    rowCount: formData.get("rowCount") ?? "",
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const rowCount = typeof parsed.data.rowCount === "number" ? parsed.data.rowCount : null;
  const supabase = createClient(await cookies());
  const { error } = await supabase.from("import_jobs").insert({
    kind: parsed.data.kind,
    source_name: parsed.data.sourceName,
    source_url: parsed.data.sourceUrl || null,
    status: parsed.data.status,
    row_count: rowCount,
    created_by: admin.id,
  });
  if (error) {
    console.error("[createImportJobAction] failed:", error);
    return;
  }
  revalidatePath("/admin/imports");
}

export async function updateImportJobAction(formData: FormData): Promise<void> {
  const admin = await requirePermission("admin.manage_imports");
  if (!admin) return;
  const parsed = ImportJobSchema.extend({ id: z.string().uuid() }).safeParse({
    id: formData.get("id"),
    kind: formData.get("kind"),
    sourceName: formData.get("sourceName"),
    sourceUrl: formData.get("sourceUrl") ?? "",
    status: formData.get("status") ?? "draft",
    rowCount: formData.get("rowCount") ?? "",
  });
  if (!parsed.success) return console.error(firstError(parsed.error));
  const rowCount = typeof parsed.data.rowCount === "number" ? parsed.data.rowCount : null;
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("import_jobs")
    .update({
      kind: parsed.data.kind,
      source_name: parsed.data.sourceName,
      source_url: parsed.data.sourceUrl || null,
      status: parsed.data.status,
      row_count: rowCount,
      created_by: admin.id,
    })
    .eq("id", parsed.data.id);
  if (error) console.error("[updateImportJobAction] failed:", error);
  revalidatePath("/admin/imports");
}

export async function deleteImportJobAction(formData: FormData): Promise<void> {
  if (!(await requirePermission("admin.manage_imports"))) return;
  const parsed = IdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return console.error(firstError(parsed.error));
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("import_jobs")
    .delete()
    .eq("id", parsed.data.id);
  if (error) console.error("[deleteImportJobAction] failed:", error);
  revalidatePath("/admin/imports");
}
