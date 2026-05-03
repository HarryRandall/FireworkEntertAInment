"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUserId } from "@/lib/current-user.server";
import { requirePermission } from "@/lib/platform.server";
import { slugifyTitle } from "@/lib/shows";
import {
  DEFAULT_OPENROUTER_MODEL,
  IMPORT_VIDEO_BUCKET,
  ImportedFireworkSpecSchema,
  latestImportedSpecFromOutputs,
  MAX_IMPORT_VIDEO_SECONDS,
  OPENROUTER_MODEL_OPTIONS,
  type ImportedFireworkSpec,
} from "@/lib/imports";
import type { Json } from "@/lib/database.types";

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
  role: z.string().uuid(),
});

const PermissionOverrideSchema = z.object({
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  mode: z.enum(["grant", "deny", "clear"]),
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

export type ImportUploadActionState = {
  ok: boolean;
  error: string | null;
};

const ModelSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (model) =>
      OPENROUTER_MODEL_OPTIONS.some((option) => option.value === model),
    "Choose a supported OpenRouter model.",
  );

const VideoImportSchema = z.object({
  sourceName: z.string().trim().min(1).max(180),
  selectedModel: ModelSchema.default(DEFAULT_OPENROUTER_MODEL),
  reportedDurationSeconds: z.coerce
    .number()
    .min(0)
    .max(MAX_IMPORT_VIDEO_SECONDS)
    .optional()
    .or(z.literal("")),
});

const QueueImportSchema = z.object({
  id: z.string().uuid(),
  selectedModel: ModelSchema.default(DEFAULT_OPENROUTER_MODEL),
});

const RefinementSchema = z.object({
  id: z.string().uuid(),
  selectedModel: ModelSchema.default(DEFAULT_OPENROUTER_MODEL),
  prompt: z.string().trim().min(3).max(2000),
});

const ManualDraftSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional(),
  durationSeconds: z.coerce.number().min(0.1).max(MAX_IMPORT_VIDEO_SECONDS),
  launchTimeSeconds: z.coerce.number().min(0).max(MAX_IMPORT_VIDEO_SECONDS),
  burstTimeSeconds: z.coerce.number().min(0).max(MAX_IMPORT_VIDEO_SECONDS),
  endTimeSeconds: z.coerce.number().min(0).max(MAX_IMPORT_VIDEO_SECONDS),
  colors: z.string().trim().min(4).max(120),
  particleCount: z.coerce.number().int().min(40).max(900),
  spread: z.coerce.number().min(0.4).max(8),
  launchHeight: z.coerce.number().min(0.5).max(8),
  burstDuration: z.coerce.number().min(0.25).max(8),
  gravity: z.coerce.number().min(-6).max(1),
  drag: z.coerce.number().min(0.05).max(0.99),
  sparkSize: z.coerce.number().min(0.015).max(0.22),
  trailLength: z.coerce.number().min(0).max(2.5),
  secondaryBursts: z.coerce.number().int().min(0).max(4),
});

const ApproveImportSchema = z.object({
  id: z.string().uuid(),
  partNumber: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  manufacturer: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  fireworkType: z.string().trim().max(80).optional(),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form details.";
}

function sanitizeStorageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "firework-video";
}

function parseHexColors(input: string): string[] {
  const colors = input
    .split(/[\s,]+/)
    .map((color) => color.trim())
    .filter(Boolean);
  if (colors.length === 0) return ["#00E5FF"];
  const invalid = colors.find((color) => !/^#[0-9a-fA-F]{6}$/.test(color));
  if (invalid) throw new Error(`Invalid colour ${invalid}. Use #RRGGBB.`);
  return colors.slice(0, 8);
}

async function latestSpecForImport(
  importJobId: string,
): Promise<ImportedFireworkSpec | null> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("import_outputs")
    .select("output_type, payload, created_at")
    .eq("import_job_id", importJobId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[latestSpecForImport] failed:", error);
    return null;
  }
  return latestImportedSpecFromOutputs(
    (data ?? []).map((row) => ({
      outputType: row.output_type,
      payload: row.payload,
    })),
  );
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
    role: formData.get("role"),
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
    {
      user_id: parsed.data.userId,
      role_id: parsed.data.role,
      assigned_by: admin.id,
    },
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

export async function createVideoImportJobAction(
  _state: ImportUploadActionState,
  formData: FormData,
): Promise<ImportUploadActionState> {
  const admin = await requirePermission("admin.manage_imports");
  if (!admin) {
    return { ok: false, error: "You do not have permission to manage imports." };
  }

  const parsed = VideoImportSchema.safeParse({
    sourceName: formData.get("sourceName"),
    selectedModel: formData.get("selectedModel") ?? DEFAULT_OPENROUTER_MODEL,
    reportedDurationSeconds: formData.get("reportedDurationSeconds") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const file = formData.get("videoFile");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a video file before uploading." };
  }
  // Some browsers report an empty file.type for less common containers
  // (e.g. MPEG-4 SP). Accept those too if the file extension is a video
  // container — the bucket's allowed_mime_types will still reject anything
  // truly unsupported, and the worker re-probes with ffprobe.
  const looksLikeVideoByName = /\.(mp4|m4v|mov|webm|mkv)$/i.test(file.name);
  if (!file.type.startsWith("video/") && !looksLikeVideoByName) {
    return { ok: false, error: "Choose a supported video file." };
  }
  // When the browser hasn't filled in a mime, infer one from the extension so
  // the upload doesn't get blocked by the bucket's allowed_mime_types check.
  const inferredContentType =
    file.type && file.type.startsWith("video/")
      ? file.type
      : /\.mov$/i.test(file.name)
        ? "video/quicktime"
        : /\.webm$/i.test(file.name)
          ? "video/webm"
          : /\.mkv$/i.test(file.name)
            ? "video/x-matroska"
            : "video/mp4";

  const supabase = createClient(await cookies());
  const storagePath = `${admin.id}/${crypto.randomUUID()}-${sanitizeStorageName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(IMPORT_VIDEO_BUCKET)
    .upload(storagePath, file, {
      contentType: inferredContentType,
      upsert: false,
    });
  if (uploadError) {
    console.error("[createVideoImportJobAction] upload failed:", uploadError);
    const detail = uploadError.message ?? "";
    // Surface the underlying storage failure so the operator can act on it
    // instead of always blaming a missing migration.
    return {
      ok: false,
      error: detail
        ? `Video upload failed: ${detail}`
        : "Video upload failed. Apply migration 0008 first so the import-videos storage bucket exists.",
    };
  }

  const duration =
    typeof parsed.data.reportedDurationSeconds === "number"
      ? parsed.data.reportedDurationSeconds
      : null;
  const { data: media, error: mediaError } = await supabase
    .from("media_assets")
    .insert({
      owner_id: admin.id,
      source_type: "upload",
      storage_path: storagePath,
      mime_type: file.type || null,
      duration_seconds: duration,
      metadata: {
        originalName: file.name,
        sizeBytes: file.size,
      } as Json,
    })
    .select("id")
    .single();
  if (mediaError || !media) {
    console.error("[createVideoImportJobAction] media insert failed:", mediaError);
    return {
      ok: false,
      error:
        "Could not create the media record. Apply migration 0008 and try again.",
    };
  }

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      kind: "firework_video",
      status: "queued",
      source_name: parsed.data.sourceName,
      media_asset_id: media.id,
      selected_model: parsed.data.selectedModel,
      processing_progress: 0,
      created_by: admin.id,
      row_count: 0,
    })
    .select("id")
    .single();
  if (jobError || !job) {
    console.error("[createVideoImportJobAction] import job insert failed:", jobError);
    return {
      ok: false,
      error:
        "Could not create the import job. Apply migration 0008 and try again.",
    };
  }

  revalidatePath("/admin/imports");
  redirect(`/admin/imports/${job.id}`);
}

export async function queueImportJobAction(formData: FormData): Promise<void> {
  const admin = await requirePermission("admin.manage_imports");
  if (!admin) return;
  const parsed = QueueImportSchema.safeParse({
    id: formData.get("id"),
    selectedModel: formData.get("selectedModel") ?? DEFAULT_OPENROUTER_MODEL,
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("import_jobs")
    .update({
      status: "queued",
      selected_model: parsed.data.selectedModel,
      processing_progress: 0,
      error_message: null,
      started_at: null,
      completed_at: null,
      created_by: admin.id,
    })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("[queueImportJobAction] failed:", error);
    return;
  }
  revalidatePath("/admin/imports");
  revalidatePath(`/admin/imports/${parsed.data.id}`);
}

export async function requestImportRefinementAction(
  formData: FormData,
): Promise<void> {
  const admin = await requirePermission("admin.manage_imports");
  if (!admin) return;
  const parsed = RefinementSchema.safeParse({
    id: formData.get("id"),
    selectedModel: formData.get("selectedModel") ?? DEFAULT_OPENROUTER_MODEL,
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const currentSpec = await latestSpecForImport(parsed.data.id);
  const supabase = createClient(await cookies());
  const { error: outputError } = await supabase.from("import_outputs").insert({
    import_job_id: parsed.data.id,
    output_type: "refinement",
    payload: {
      prompt: parsed.data.prompt,
      requestedModel: parsed.data.selectedModel,
      requestedBy: admin.id,
      spec: currentSpec,
    } as Json,
  });
  if (outputError) {
    console.error("[requestImportRefinementAction] output failed:", outputError);
    return;
  }

  const { error: jobError } = await supabase
    .from("import_jobs")
    .update({
      status: "queued",
      selected_model: parsed.data.selectedModel,
      processing_progress: 0,
      error_message: null,
      started_at: null,
      completed_at: null,
    })
    .eq("id", parsed.data.id);
  if (jobError) console.error("[requestImportRefinementAction] job failed:", jobError);
  revalidatePath(`/admin/imports/${parsed.data.id}`);
}

export async function updateImportDraftSpecAction(
  formData: FormData,
): Promise<void> {
  const admin = await requirePermission("admin.manage_imports");
  if (!admin) return;
  const parsed = ManualDraftSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    durationSeconds: formData.get("durationSeconds"),
    launchTimeSeconds: formData.get("launchTimeSeconds"),
    burstTimeSeconds: formData.get("burstTimeSeconds"),
    endTimeSeconds: formData.get("endTimeSeconds"),
    colors: formData.get("colors"),
    particleCount: formData.get("particleCount"),
    spread: formData.get("spread"),
    launchHeight: formData.get("launchHeight"),
    burstDuration: formData.get("burstDuration"),
    gravity: formData.get("gravity"),
    drag: formData.get("drag"),
    sparkSize: formData.get("sparkSize"),
    trailLength: formData.get("trailLength"),
    secondaryBursts: formData.get("secondaryBursts"),
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  let colors: string[];
  try {
    colors = parseHexColors(parsed.data.colors);
  } catch (error) {
    console.error("[updateImportDraftSpecAction]", error);
    return;
  }

  const burstTime = Math.max(
    parsed.data.launchTimeSeconds,
    parsed.data.burstTimeSeconds,
  );
  const endTime = Math.max(burstTime, parsed.data.endTimeSeconds);
  const spec: ImportedFireworkSpec = ImportedFireworkSpecSchema.parse({
    name: parsed.data.name,
    description: parsed.data.description || null,
    durationSeconds: parsed.data.durationSeconds,
    confidence: 0.85,
    renderSpec: {
      particleCount: parsed.data.particleCount,
      burstDuration: parsed.data.burstDuration,
      colors,
      spread: parsed.data.spread,
      launchHeight: parsed.data.launchHeight,
      gravity: parsed.data.gravity,
      drag: parsed.data.drag,
      sparkSize: parsed.data.sparkSize,
      trailLength: parsed.data.trailLength,
      secondaryBursts: parsed.data.secondaryBursts || undefined,
      audioSync: [
        {
          timeSeconds: parsed.data.launchTimeSeconds,
          kind: "launch",
          confidence: 0.85,
        },
        { timeSeconds: burstTime, kind: "burst", confidence: 0.85 },
      ],
      sections: [
        {
          id: "manual-main-burst",
          label: "Main burst",
          phase: "burst",
          startTimeSeconds: parsed.data.launchTimeSeconds,
          burstTimeSeconds: burstTime,
          endTimeSeconds: endTime,
          colors,
          particleCount: parsed.data.particleCount,
          spread: parsed.data.spread,
          launchHeight: parsed.data.launchHeight,
          burstDuration: parsed.data.burstDuration,
          gravity: parsed.data.gravity,
          drag: parsed.data.drag,
          sparkSize: parsed.data.sparkSize,
          trailLength: parsed.data.trailLength,
          secondaryBursts: parsed.data.secondaryBursts || undefined,
          confidence: 0.85,
        },
      ],
    },
  });

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("import_outputs").insert({
    import_job_id: parsed.data.id,
    output_type: "draft_spec",
    payload: {
      source: "manual_adjustment",
      adjustedBy: admin.id,
      spec,
    } as Json,
  });
  if (error) {
    console.error("[updateImportDraftSpecAction] failed:", error);
    return;
  }
  await supabase
    .from("import_jobs")
    .update({ status: "needs_review", processing_progress: 100 })
    .eq("id", parsed.data.id);
  revalidatePath(`/admin/imports/${parsed.data.id}`);
}

export async function approveImportJobAction(formData: FormData): Promise<void> {
  const importAdmin = await requirePermission("admin.manage_imports");
  const catalogueAdmin = await requirePermission("admin.manage_catalogue");
  if (!importAdmin || !catalogueAdmin) return;
  const parsed = ApproveImportSchema.safeParse({
    id: formData.get("id"),
    partNumber: formData.get("partNumber"),
    name: formData.get("name"),
    manufacturer: formData.get("manufacturer") ?? "",
    category: formData.get("category") ?? "",
    fireworkType: formData.get("fireworkType") ?? "",
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const spec = await latestSpecForImport(parsed.data.id);
  if (!spec) {
    console.error("[approveImportJobAction] no valid generated spec");
    return;
  }

  const supabase = createClient(await cookies());
  const { data: job } = await supabase
    .from("import_jobs")
    .select("media_asset_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const fireworkSlug = `${slugifyTitle(parsed.data.name)}-${parsed.data.id.slice(0, 8)}`;
  const { data: firework, error: fireworkError } = await supabase
    .from("firework_specifications")
    .insert({
      slug: fireworkSlug,
      name: parsed.data.name,
      description: spec.description || null,
      sort_order: 100,
      spec: spec.effectSpec as unknown as Json,
      source_import_job_id: parsed.data.id,
      source_media_asset_id: job?.media_asset_id ?? null,
      review_status: "approved",
    })
    .select("id")
    .single();
  if (fireworkError || !firework) {
    console.error("[approveImportJobAction] firework insert failed:", fireworkError);
    return;
  }

  const { data: product, error: productError } = await supabase
    .from("catalogue_products")
    .insert({
      part_number: parsed.data.partNumber,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer || null,
      category: parsed.data.category || "Imported video",
      firework_type: parsed.data.fireworkType || "Video reconstructed",
      duration_seconds: spec.durationSeconds,
      description: spec.description || null,
      firework_specification_id: firework.id,
      source_table: "import_jobs",
      source_payload: {
        importJobId: parsed.data.id,
        confidence: spec.confidence,
        generatedSpec: spec.effectSpec,
        observations: spec.observations ?? null,
        legacyRenderProjection: spec.renderSpec,
      } as Json,
    })
    .select("id")
    .single();
  if (productError || !product) {
    console.error("[approveImportJobAction] product insert failed:", productError);
    return;
  }

  const { error: jobError } = await supabase
    .from("import_jobs")
    .update({
      status: "complete",
      processing_progress: 100,
      approved_catalogue_product_id: product.id,
      approved_firework_specification_id: firework.id,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", parsed.data.id);
  if (jobError) console.error("[approveImportJobAction] job update failed:", jobError);
  revalidatePath("/admin/imports");
  revalidatePath("/admin/catalogue");
  revalidatePath(`/admin/imports/${parsed.data.id}`);
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
