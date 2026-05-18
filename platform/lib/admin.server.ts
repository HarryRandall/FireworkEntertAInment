import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUserId } from "@/lib/current-user.server";
import { getCachedJson, setCachedJson } from "@/lib/server-cache";
import type {
  AdminUser,
  CatalogueProductSummary,
  CurrentProfile,
  ImportJobDetail,
  ImportJobSummary,
  ImportOutputSummary,
  MediaAssetSummary,
  Permission,
  PermissionKey,
  ProfileStatus,
  Role,
  RoleKey,
  ShowTemplate,
  ShowTemplateCue,
  SupplierSummary,
  ThemePreference,
} from "@/lib/admin.types";
import type { Database, Json } from "@/lib/database.types";
import { IMPORT_VIDEO_BUCKET } from "@/lib/import-jobs";
import { getPreferredImportVideoSource } from "@/lib/import-video-preview.js";
import { createServiceRoleSupabase } from "@/utils/supabase/service-role";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type RoleRow = Database["public"]["Tables"]["roles"]["Row"];
type PermissionRow = Database["public"]["Tables"]["permissions"]["Row"];
type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
type RolePermissionRow = Database["public"]["Tables"]["role_permissions"]["Row"];
type UserPermissionOverrideRow =
  Database["public"]["Tables"]["user_permission_overrides"]["Row"];
type SupplierRow = Database["public"]["Tables"]["supplier_profiles"]["Row"];
type ImportJobRow = Database["public"]["Tables"]["import_jobs"]["Row"];
type ImportOutputRow = Database["public"]["Tables"]["import_outputs"]["Row"];
type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ShowTemplateRow = Database["public"]["Tables"]["show_templates"]["Row"];
const PLATFORM_CACHE_PREFIX = "platform:v1";
const SHOW_TEMPLATES_TTL_SECONDS = 60 * 10;

const ROLE_KEYS: readonly RoleKey[] = ["admin", "supplier", "user"];

function isRoleKey(value: string): value is RoleKey {
  return ROLE_KEYS.includes(value as RoleKey);
}

function asRoleKey(value: string): RoleKey {
  return isRoleKey(value) ? value : "user";
}

function asPermissionKey(value: string): PermissionKey {
  return value as PermissionKey;
}

function asProfileStatus(value: string): ProfileStatus {
  return value === "suspended" ? "suspended" : "active";
}

function asThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "system" ? value : "dark";
}

function mapRole(row: RoleRow): Role {
  return {
    id: row.id,
    key: asRoleKey(row.key),
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

function mapPermission(row: PermissionRow): Permission {
  return {
    id: row.id,
    key: asPermissionKey(row.key),
    name: row.name,
    description: row.description,
    category: row.category,
  };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

const getServerClient = cache(async () => createClient(await cookies()));

async function createSignedImportVideoUrl(
  storagePath: string,
  sessionSupabase: Awaited<ReturnType<typeof getServerClient>>,
): Promise<string | null> {
  const service = createServiceRoleSupabase();
  if (service) {
    const svcResult = await service.storage
      .from(IMPORT_VIDEO_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (!svcResult.error && svcResult.data?.signedUrl) {
      return svcResult.data.signedUrl;
    }
    console.error(
      "[admin.server] service-role import video signing failed:",
      svcResult.error?.message ?? "unknown",
    );
  }

  const { data: signed, error: signedError } = await sessionSupabase.storage
    .from(IMPORT_VIDEO_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (signedError || !signed?.signedUrl) {
    console.error(
      "[admin.server] session import video signing failed:",
      signedError?.message ?? "missing URL",
    );
    return null;
  }
  return signed.signedUrl;
}

function isRecord(value: Json | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTemplateCues(value: Json): ShowTemplateCue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const timeSeconds = item.timeSeconds;
    const description = item.description;
    const fireworkSlug = item.fireworkSlug;
    if (
      typeof timeSeconds !== "number" ||
      typeof description !== "string" ||
      typeof fireworkSlug !== "string"
    ) {
      return [];
    }
    return [{ timeSeconds, description, fireworkSlug }];
  });
}

function deriveTemplateLikeCount(row: ShowTemplateRow): number {
  let hash = 0;
  for (const char of row.slug) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const featuredBoost = row.is_featured ? 140 : 40;
  return featuredBoost + row.effects_count * 6 + (hash % 95);
}

function mapShowTemplate(row: ShowTemplateRow): ShowTemplate {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    theme: row.theme,
    description: row.description,
    durationSeconds: row.duration_seconds,
    budgetCents: row.budget_cents,
    totalCents: row.total_cents,
    effectsCount: row.effects_count,
    timeOfDay: row.time_of_day,
    moodTags: row.mood_tags ?? [],
    previewCues: parseTemplateCues(row.preview_cues),
    isFeatured: row.is_featured,
    likeCount: deriveTemplateLikeCount(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImportJob(row: ImportJobRow): ImportJobSummary {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    mediaAssetId: row.media_asset_id,
    selectedModel: row.selected_model,
    processingProgress: row.processing_progress,
    approvedProductId: row.approved_product_id,
    approvedFireworkSpecificationId: row.approved_firework_specification_id,
    rowCount: row.row_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImportOutput(row: ImportOutputRow): ImportOutputSummary {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    outputType: row.output_type,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

function mapMediaAsset(row: MediaAssetRow): MediaAssetSummary {
  return {
    id: row.id,
    sourceType: row.source_type,
    url: row.url,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    durationSeconds:
      row.duration_seconds == null ? null : Number(row.duration_seconds),
    width: row.width,
    height: row.height,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function parseAccessRpc(value: Json): CurrentProfile | null {
  if (!isRecord(value)) return null;
  const profile = value.profile;
  if (!isRecord(profile) || typeof profile.id !== "string") return null;
  const roles = Array.isArray(value.roles)
    ? value.roles.filter((role): role is string => typeof role === "string").map(asRoleKey)
    : [];
  const permissions = Array.isArray(value.permissions)
    ? value.permissions
        .filter((permission): permission is string => typeof permission === "string")
        .map(asPermissionKey)
    : [];
  return {
    id: profile.id,
    email: typeof profile.email === "string" ? profile.email : null,
    fullName: typeof profile.full_name === "string" ? profile.full_name : null,
    phone: typeof profile.phone === "string" ? profile.phone : null,
    status:
      typeof profile.status === "string"
        ? asProfileStatus(profile.status)
        : "active",
    themePreference: asThemePreference(profile.theme_preference),
    roles: roles.length > 0 ? unique(roles) : ["user"],
    permissions: unique(permissions),
  };
}

export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await getServerClient();
  const { data: accessData, error: accessError } = await supabase.rpc(
    "current_user_access",
  );
  if (!accessError) {
    const parsed = parseAccessRpc(accessData);
    if (parsed) return parsed;
  }

  const [
    { data: profile },
    { data: allRoles },
    { data: userRoles },
    { data: rolePermissions },
    { data: allPermissions },
    { data: overrides },
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, phone, status, theme_preference")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("roles").select("id, key, name, description, sort_order, created_at, updated_at"),
      supabase.from("user_roles").select("user_id, role_id, assigned_by, created_at").eq("user_id", userId),
      supabase.from("role_permissions").select("role_id, permission_id, created_at"),
      supabase.from("permissions").select("id, key, name, description, category, created_at, updated_at"),
      supabase
        .from("user_permission_overrides")
        .select("user_id, permission_id, enabled, assigned_by, created_at, updated_at")
        .eq("user_id", userId),
    ]);

  if (!profile) return null;

  const rolesById = new Map((allRoles ?? []).map((role) => [role.id, mapRole(role)]));
  const permissionsById = new Map(
    (allPermissions ?? []).map((permission) => [permission.id, mapPermission(permission)]),
  );
  const roleIds = new Set(((userRoles ?? []) as UserRoleRow[]).map((row) => row.role_id));
  const roleKeys = unique(
    Array.from(roleIds)
      .map((roleId) => rolesById.get(roleId)?.key)
      .filter((key): key is RoleKey => Boolean(key)),
  );

  const granted = new Set<PermissionKey>();
  for (const row of (rolePermissions ?? []) as RolePermissionRow[]) {
    if (!roleIds.has(row.role_id)) continue;
    const permission = permissionsById.get(row.permission_id);
    if (permission) granted.add(permission.key);
  }
  for (const override of (overrides ?? []) as UserPermissionOverrideRow[]) {
    const permission = permissionsById.get(override.permission_id);
    if (!permission) continue;
    if (override.enabled) granted.add(permission.key);
    else granted.delete(permission.key);
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    phone: profile.phone,
    status: asProfileStatus(profile.status),
    themePreference: asThemePreference(profile.theme_preference),
    roles: roleKeys.length > 0 ? roleKeys : ["user"],
    permissions: Array.from(granted),
  };
});

export async function requirePermission(permission: PermissionKey) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.permissions.includes(permission)) return null;
  return profile;
}

export async function listRoles(): Promise<Role[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, key, name, description, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[admin.server] listRoles failed:", error);
    return [];
  }
  return (data ?? []).map(mapRole);
}

export async function listPermissions(): Promise<Permission[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("id, key, name, description, category, created_at, updated_at")
    .order("category", { ascending: true })
    .order("key", { ascending: true });
  if (error) {
    console.error("[admin.server] listPermissions failed:", error);
    return [];
  }
  return (data ?? []).map(mapPermission);
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const admin = await requirePermission("admin.manage_users");
  if (!admin) return [];

  const supabase = await getServerClient();
  const [{ data: profiles }, { data: userRoles }, { data: roles }, { data: overrides }, { data: permissions }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, phone, status, updated_at")
        .order("updated_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role_id, assigned_by, created_at"),
      supabase
        .from("roles")
        .select("id, key, name, description, sort_order, created_at, updated_at"),
      supabase
        .from("user_permission_overrides")
        .select("user_id, permission_id, enabled, assigned_by, created_at, updated_at"),
      supabase
        .from("permissions")
        .select("id, key, name, description, category, created_at, updated_at"),
    ]);

  const roleById = new Map((roles ?? []).map((role) => [role.id, mapRole(role)]));
  const permissionById = new Map(
    (permissions ?? []).map((permission) => [permission.id, mapPermission(permission)]),
  );

  return ((profiles ?? []) as Pick<
    ProfileRow,
    "id" | "email" | "full_name" | "phone" | "status" | "updated_at"
  >[]).map((profile) => {
    const assignedRoles = ((userRoles ?? []) as UserRoleRow[])
      .filter((row) => row.user_id === profile.id)
      .map((row) => roleById.get(row.role_id)?.key)
      .filter((key): key is RoleKey => Boolean(key));
    const permissionOverrides = ((overrides ?? []) as UserPermissionOverrideRow[])
      .filter((row) => row.user_id === profile.id)
      .map((row) => {
        const permission = permissionById.get(row.permission_id);
        if (!permission) return null;
        return {
          permissionId: row.permission_id,
          permissionKey: permission.key,
          enabled: row.enabled,
        };
      })
      .filter((row): row is AdminUser["permissionOverrides"][number] => row !== null);

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      phone: profile.phone,
      status: asProfileStatus(profile.status),
      updatedAt: profile.updated_at,
      roles: assignedRoles.length > 0 ? assignedRoles : ["user"],
      permissionOverrides,
    };
  });
}

export async function getAdminUserById(userId: string): Promise<AdminUser | null> {
  const users = await listAdminUsers();
  return users.find((user) => user.id === userId) ?? null;
}

export type UserActivity = {
  shows30d: { date: string; count: number }[];
  stats: {
    accountAgeDays: number | null;
    lastSignInAt: string | null;
    totalShows: number;
    shows30dCount: number;
  };
};

export async function getUserActivity(userId: string): Promise<UserActivity | null> {
  if (!(await requirePermission("admin.manage_users"))) return null;

  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  const service = createServiceRoleSupabase();
  const supabase = service ?? (await getServerClient());

  const [{ data: showsAll }, { data: showsRecent }] = await Promise.all([
    supabase.from("shows").select("id", { count: "exact", head: false }).eq("user_id", userId),
    supabase.from("shows").select("created_at").eq("user_id", userId).gte("created_at", sinceIso),
  ]);

  const buckets = new Map<string, number>();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of (showsRecent ?? []) as { created_at: string }[]) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const shows30d = Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));

  let lastSignInAt: string | null = null;
  let accountAgeDays: number | null = null;
  if (service) {
    const { data: authUser } = await service.auth.admin.getUserById(userId);
    if (authUser?.user) {
      lastSignInAt = authUser.user.last_sign_in_at ?? null;
      const createdAt = authUser.user.created_at ?? null;
      if (createdAt) {
        const ms = now.getTime() - new Date(createdAt).getTime();
        accountAgeDays = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
      }
    }
  }

  return {
    shows30d,
    stats: {
      accountAgeDays,
      lastSignInAt,
      totalShows: showsAll?.length ?? 0,
      shows30dCount: (showsRecent ?? []).length,
    },
  };
}

export async function listSuppliers(): Promise<SupplierSummary[]> {
  if (
    !(await requirePermission("admin.manage_suppliers")) &&
    !(await requirePermission("supplier.view"))
  ) {
    return [];
  }
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("supplier_profiles")
    .select("id, name, slug, status, contact_email, phone, website_url, updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[admin.server] listSuppliers failed:", error);
    return [];
  }
  return ((data ?? []) as Pick<
    SupplierRow,
    "id" | "name" | "slug" | "status" | "contact_email" | "phone" | "website_url" | "updated_at"
  >[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    contactEmail: row.contact_email,
    phone: row.phone,
    websiteUrl: row.website_url,
    updatedAt: row.updated_at,
  }));
}

export async function listImportJobs(): Promise<ImportJobSummary[]> {
  if (!(await requirePermission("admin.manage_imports"))) return [];
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .select(
      "id, created_by, kind, status, source_name, source_url, media_asset_id, selected_model, processing_progress, processor_version, approved_product_id, approved_firework_specification_id, row_count, error_message, started_at, completed_at, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("import_jobs")
      .select("id, kind, status, source_name, source_url, row_count, error_message, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (fallbackError) {
      console.error("[admin.server] listImportJobs failed:", fallbackError);
      return [];
    }
    return ((fallbackData ?? []) as Pick<
      ImportJobRow,
      | "id"
      | "kind"
      | "status"
      | "source_name"
      | "source_url"
      | "row_count"
      | "error_message"
      | "created_at"
      | "updated_at"
    >[]).map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      mediaAssetId: null,
      selectedModel: null,
      processingProgress: row.status === "complete" ? 100 : 0,
      approvedProductId: null,
      approvedFireworkSpecificationId: null,
      rowCount: row.row_count,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
  return ((data ?? []) as ImportJobRow[]).map(mapImportJob);
}

export async function getImportJobDetail(
  jobId: string,
): Promise<ImportJobDetail | null> {
  if (!(await requirePermission("admin.manage_imports"))) return null;
  const supabase = await getServerClient();
  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .select(
      "id, created_by, kind, status, source_name, source_url, media_asset_id, selected_model, processing_progress, processor_version, approved_product_id, approved_firework_specification_id, row_count, error_message, started_at, completed_at, created_at, updated_at",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) {
    console.error("[admin.server] getImportJobDetail failed:", jobError);
    return null;
  }
  if (!job) return null;

  const [mediaResult, outputsResult] = await Promise.all([
    job.media_asset_id
      ? supabase
          .from("media_assets")
          .select(
            "id, owner_id, source_type, url, storage_path, mime_type, duration_seconds, width, height, metadata, created_at",
          )
          .eq("id", job.media_asset_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("import_outputs")
      .select("id, import_job_id, output_type, payload, created_at")
      .eq("import_job_id", job.id)
      .order("created_at", { ascending: true }),
  ]);

  if (mediaResult.error) {
    console.error("[admin.server] import media lookup failed:", mediaResult.error);
  }
  if (outputsResult.error) {
    console.error("[admin.server] import outputs lookup failed:", outputsResult.error);
  }

  const media = mediaResult.data ? mapMediaAsset(mediaResult.data as MediaAssetRow) : null;
  const preferredVideo = media
    ? getPreferredImportVideoSource(media)
    : { storagePath: null, mimeType: null };
  let videoUrl = media?.url ?? job.source_url ?? null;
  if (preferredVideo.storagePath) {
    const signedUrl = await createSignedImportVideoUrl(
      preferredVideo.storagePath,
      supabase,
    );
    if (signedUrl) {
      videoUrl = signedUrl;
    } else if (media?.storagePath && media.storagePath !== preferredVideo.storagePath) {
      const fallbackSignedUrl = await createSignedImportVideoUrl(
        media.storagePath,
        supabase,
      );
      if (fallbackSignedUrl) {
        videoUrl = fallbackSignedUrl;
      }
    }
  }

  return {
    ...mapImportJob(job as ImportJobRow),
    mediaAsset: media,
    outputs: ((outputsResult.data ?? []) as ImportOutputRow[]).map(mapImportOutput),
    videoUrl,
    videoMimeType: preferredVideo.mimeType ?? media?.mimeType ?? null,
  };
}

export async function listCatalogueProducts(): Promise<CatalogueProductSummary[]> {
  if (!(await requirePermission("admin.manage_catalogue"))) return [];
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, part_number, name, manufacturer, subtype, duration_seconds, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[admin.server] listCatalogueProducts failed:", error);
    return [];
  }
  return ((data ?? []) as Pick<
    ProductRow,
    | "id"
    | "part_number"
    | "name"
    | "manufacturer"
    | "subtype"
    | "duration_seconds"
    | "updated_at"
  >[]).map((row) => ({
    id: row.id,
    partNumber: row.part_number,
    name: row.name,
    manufacturer: row.manufacturer,
    category: null,
    fireworkType: row.subtype,
    fireworkSpecificationId: null,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    updatedAt: row.updated_at,
  }));
}

export async function listShowTemplates(): Promise<ShowTemplate[]> {
  const cacheKey = `${PLATFORM_CACHE_PREFIX}:show-templates`;
  const cached = await getCachedJson<ShowTemplate[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("show_templates")
    .select(
      "id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, preview_cues, is_featured, sort_order, created_at, updated_at",
    )
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[admin.server] listShowTemplates failed:", error);
    return [];
  }
  const mapped = ((data ?? []) as ShowTemplateRow[]).map(mapShowTemplate);
  await setCachedJson(cacheKey, mapped, SHOW_TEMPLATES_TTL_SECONDS);
  return mapped;
}

export async function getShowTemplateBySlug(
  slug: string,
): Promise<ShowTemplate | null> {
  const cachedTemplates = await listShowTemplates();
  const cached = cachedTemplates.find((template) => template.slug === slug);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("show_templates")
    .select(
      "id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, preview_cues, is_featured, sort_order, created_at, updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[admin.server] getShowTemplateBySlug failed:", error);
    return null;
  }
  return data ? mapShowTemplate(data as ShowTemplateRow) : null;
}
