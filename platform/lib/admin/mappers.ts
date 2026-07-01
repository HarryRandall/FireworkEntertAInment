/**
 * Pure row → domain mappers and string coercers used across `lib/admin/*`.
 *
 * Every function here is deterministic and free of I/O. Server modules call
 * them after a Supabase fetch to translate the raw `Database['public']`
 * row shapes into the {@link ../admin.types} domain shapes the UI expects.
 */
import type {
  AdminUser,
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
  ThemePreference,
} from '@/lib/admin.types';
import type { Database, Json } from '@/lib/database.types';
import { parseShaderCover } from '@/lib/shader-cover';

export type ProfileRow = Database['public']['Tables']['users']['Row'];
export type RoleRow = Database['public']['Tables']['roles']['Row'];
export type PermissionRow = Database['public']['Tables']['permissions']['Row'];
export type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];
export type RolePermissionRow = Database['public']['Tables']['role_permissions']['Row'];
export type UserPermissionOverrideRow =
  Database['public']['Tables']['user_permission_overrides']['Row'];
export type SupplierRow = Database['public']['Tables']['supplier_profiles']['Row'];
export type ImportJobRow = Database['public']['Tables']['import_jobs']['Row'];
export type ImportOutputRow = Database['public']['Tables']['import_outputs']['Row'];
export type MediaAssetRow = Database['public']['Tables']['media_assets']['Row'];
export type ShowTemplateRow = Database['public']['Tables']['show_presets']['Row'];

const ROLE_KEYS: readonly RoleKey[] = ['admin', 'supplier', 'user'];

function isRoleKey(value: string): value is RoleKey {
  return ROLE_KEYS.includes(value as RoleKey);
}

/** Coerce a free-form string into a known {@link RoleKey} (defaults to `user`). */
export function asRoleKey(value: string): RoleKey {
  return isRoleKey(value) ? value : 'user';
}

/** Best-effort cast to {@link PermissionKey}. We accept unknown keys so that
 * a permission added to the DB but not yet typed in code still flows through. */
export function asPermissionKey(value: string): PermissionKey {
  return value as PermissionKey;
}

/** Map the DB profile status to the narrowed UI enum. */
export function asProfileStatus(value: string): ProfileStatus {
  return value === 'suspended' ? 'suspended' : 'active';
}

/** Coerce arbitrary JSON into a known {@link ThemePreference} (defaults to `dark`). */
export function asThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'system' ? value : 'dark';
}

/** Type guard for plain JSON objects (rejects arrays + null). */
export function isRecord(value: Json | undefined): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns a new array with duplicates removed, preserving first-seen order. */
export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Map a DB role row to the domain {@link Role}. */
export function mapRole(row: RoleRow): Role {
  return {
    id: row.id,
    key: asRoleKey(row.key),
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

/** Map a DB permission row to the domain {@link Permission}. */
export function mapPermission(row: PermissionRow): Permission {
  return {
    id: row.id,
    key: asPermissionKey(row.key),
    name: row.name,
    description: row.description,
    category: row.category,
  };
}

/** Map a DB import job row to the lightweight summary used in lists. */
export function mapImportJob(row: ImportJobRow): ImportJobSummary {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    mediaAssetId: row.media_asset_id,
    selectedModel: row.selected_model,
    processingProgress: row.processing_progress,
    approvedCatalogueItemId: row.approved_catalogue_item_id,
    rowCount: row.row_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map a DB import-output row to the UI summary shape. */
export function mapImportOutput(row: ImportOutputRow): ImportOutputSummary {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    outputType: row.output_type,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

/** Map a DB media-asset row, normalising the optional `duration_seconds` numeric. */
export function mapMediaAsset(row: MediaAssetRow): MediaAssetSummary {
  return {
    id: row.id,
    sourceType: row.source_type,
    url: row.url,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    width: row.width,
    height: row.height,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

/** Parse the JSON `preview_cues` array on a show template. Skips malformed entries. */
export function parseTemplateCues(value: Json): ShowTemplateCue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const timeSeconds = item.timeSeconds;
    const description = item.description;
    const fireworkSlug = item.fireworkSlug;
    if (
      typeof timeSeconds !== 'number' ||
      typeof description !== 'string' ||
      typeof fireworkSlug !== 'string'
    ) {
      return [];
    }
    return [{ timeSeconds, description, fireworkSlug }];
  });
}

/**
 * Synthesises a stable "like count" for a template based on its slug, featured
 * flag, and effect count. Pure decorative — replace with a real counter when
 * social interactions ship.
 */
export function deriveTemplateLikeCount(row: ShowTemplateRow): number {
  let hash = 0;
  for (const char of row.slug) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const featuredBoost = row.is_featured ? 140 : 40;
  return featuredBoost + row.effects_count * 6 + (hash % 95);
}

/** Map a DB show-template row to the domain {@link ShowTemplate}. */
export function mapShowTemplate(row: ShowTemplateRow): ShowTemplate {
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
    coverShader: parseShaderCover(row.cover_shader),
    coverImagePath: row.cover_image_path ?? null,
    isFeatured: row.is_featured,
    likeCount: deriveTemplateLikeCount(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Stitch together users + role assignments + permission overrides into the
 * AdminUser shape. Used by both the list and single-user reads to keep them
 * consistent.
 */
export function mapAdminUsersFromRows({
  users,
  userRoles,
  roles,
  overrides,
  permissions,
}: {
  users: Pick<ProfileRow, 'id' | 'email' | 'full_name' | 'phone' | 'status' | 'updated_at'>[];
  userRoles: UserRoleRow[];
  roles: RoleRow[];
  overrides: UserPermissionOverrideRow[];
  permissions: PermissionRow[];
}): AdminUser[] {
  const roleById = new Map((roles ?? []).map((role) => [role.id, mapRole(role)]));
  const permissionById = new Map(
    (permissions ?? []).map((permission) => [permission.id, mapPermission(permission)]),
  );

  return users.map((profile) => {
    const assignedRoles = userRoles
      .filter((row) => row.user_id === profile.id)
      .map((row) => roleById.get(row.role_id)?.key)
      .filter((key): key is RoleKey => Boolean(key));
    const permissionOverrides = overrides
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
      .filter((row): row is AdminUser['permissionOverrides'][number] => row !== null);

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      phone: profile.phone,
      status: asProfileStatus(profile.status),
      updatedAt: profile.updated_at,
      roles: assignedRoles.length > 0 ? assignedRoles : ['user'],
      permissionOverrides,
    };
  });
}
