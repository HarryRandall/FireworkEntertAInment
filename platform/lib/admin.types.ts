import type { Json } from '@/lib/database.types';
import type { FireworkStyleDefaultKind } from '@/lib/fireworks/style-defaults';
import type { ShowCover } from '@/lib/cover';

/**
 * Shared admin / RBAC domain types.
 *
 * Pure type definitions used by both server modules under `lib/admin/*` and
 * client components in `app/(admin)/**`. Anything that crosses the
 * server/client boundary (props for an admin page, return shape from a
 * server action) should reference types from this file rather than reaching
 * into Supabase row types directly.
 */

/** The three top-level personas the platform recognises. */
export type RoleKey = 'admin' | 'supplier' | 'user';

export type PermissionKey =
  | 'shows.create'
  | 'admin.view'
  | 'admin.manage_users'
  | 'admin.manage_billing'
  | 'admin.impersonate_users'
  | 'admin.manage_suppliers'
  | 'admin.manage_catalogue'
  | 'admin.manage_imports'
  | 'admin.manage_prompts'
  | 'supplier.view'
  | 'supplier.manage_stock';

export type ProfileStatus = 'active' | 'suspended';
export type ThemePreference = 'dark' | 'light' | 'system';

export type CurrentProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  status: ProfileStatus;
  themePreference: ThemePreference;
  roles: RoleKey[];
  permissions: PermissionKey[];
};

export type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  status: ProfileStatus;
  updatedAt: string;
  roles: RoleKey[];
  permissionOverrides: {
    permissionId: string;
    permissionKey: PermissionKey;
    enabled: boolean;
  }[];
};

export type Role = {
  id: string;
  key: RoleKey;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type Permission = {
  id: string;
  key: PermissionKey;
  name: string;
  description: string | null;
  category: string;
};

export type RolePermissionMatrix = {
  roles: Role[];
  permissions: Permission[];
  grants: {
    roleId: string;
    permissionId: string;
  }[];
};

export type SupplierSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactEmail: string | null;
  phone: string | null;
  websiteUrl: string | null;
  updatedAt: string;
};

export type ImportJobSummary = {
  id: string;
  kind: string;
  status: string;
  sourceName: string;
  sourceUrl: string | null;
  mediaAssetId: string | null;
  selectedModel: string | null;
  processingProgress: number;
  approvedCatalogueItemId: string | null;
  rowCount: number | null;
  errorMessage: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportOutputSummary = {
  id: string;
  importJobId: string;
  outputType: string;
  payload: unknown;
  createdAt: string;
};

export type MediaAssetSummary = {
  id: string;
  sourceType: string;
  url: string | null;
  storagePath: string | null;
  mimeType: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  metadata: unknown;
  createdAt: string;
};

export type ImportJobDetail = ImportJobSummary & {
  mediaAsset: MediaAssetSummary | null;
  outputs: ImportOutputSummary[];
  videoUrl: string | null;
  videoMimeType: string | null;
};

export type CatalogueProductSummary = {
  id: string;
  partNumber: string;
  name: string;
  manufacturer: string | null;
  category: string | null;
  fireworkType: string | null;
  durationSeconds: number | null;
  /** 'firework' | 'multishot' | 'bundle' | 'other'. */
  kind: string;
  /** True when the row is tied to a firework or multishot (cannot be deleted). */
  linked: boolean;
  updatedAt: string;
};

export type AdminEffectPreview = {
  colors: string[];
  label: string;
  pattern: string | null;
};

export type AdminEditorVersionTargetKind = 'firework' | 'effect' | 'style_default';
export type AdminEditorVersionAction = 'update' | 'restore';

export type AdminEditorVersion = {
  id: string;
  targetKind: AdminEditorVersionTargetKind;
  fireworkId: string | null;
  fireworkEffectId: string | null;
  fireworkStyleDefaultId: string | null;
  action: AdminEditorVersionAction;
  summary: string;
  snapshotJson: Json;
  previousSnapshotJson: Json | null;
  changesJson: Json;
  createdBy: string | null;
  createdByLabel: string;
  createdAt: string;
};

export type AdminStyleDefaultOption = {
  id: string;
  kind: FireworkStyleDefaultKind;
  name: string;
  description: string | null;
  defaultsJson: Json;
};

export type AdminStyleDefaultOptions = {
  [Kind in FireworkStyleDefaultKind]: AdminStyleDefaultOption[];
};

export type AdminStyleDefaultLinkMap = Partial<
  Record<FireworkStyleDefaultKind, AdminStyleDefaultOption | null>
>;

export type AdminStyleDefaultIdMap = Partial<Record<FireworkStyleDefaultKind, string | null>>;

export type AdminStyleDefaultSummary = AdminStyleDefaultOption & {
  slug: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminStyleDefaultDetail = AdminStyleDefaultSummary & {
  history: AdminEditorVersion[];
};

export type AdminLinkedProduct = {
  id: string;
  partNumber: string;
  name: string;
  manufacturer: string | null;
  fireworkType: string | null;
  durationSeconds: number | null;
  shots: {
    id: string;
    shotIndex: number;
    timeOffsetSeconds: number;
    panDegrees: number;
    caliber: string | null;
  }[];
};

export type AdminEffectSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  patternKey: string;
  source: string;
  sortOrder: number;
  variantCount: number;
  starStyleDefaultId: string | null;
  trailStyleDefaultId: string | null;
  styleDefaultIds: AdminStyleDefaultIdMap;
  preview: AdminEffectPreview;
  previewImagePath: string | null;
  previewImageRevision: number | null;
  updatedAt: string;
};

export type AdminEffectDetail = AdminEffectSummary & {
  modelJson: Json;
  starStyleDefault: AdminStyleDefaultOption | null;
  trailStyleDefault: AdminStyleDefaultOption | null;
  styleDefaultLinks: AdminStyleDefaultLinkMap;
  styleDefaults: AdminStyleDefaultOptions;
  history: AdminEditorVersion[];
};

/** A base effect a firework can be built on, for the firework editor selector. */
export type AdminEffectOption = {
  id: string;
  slug: string;
  name: string;
  patternKey: string;
};

/**
 * An atomic firework: one base effect plus its colours and renderer overrides.
 * This is the customisable unit shown in the admin Fireworks table.
 */
export type AdminFireworkSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  caliber: string | null;
  durationSeconds: number | null;
  heightMeters: number | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorPalette: string[];
  effectId: string | null;
  effectName: string | null;
  effectSlug: string | null;
  patternKey: string | null;
  starStyleDefaultId: string | null;
  trailStyleDefaultId: string | null;
  styleDefaultIds: AdminStyleDefaultIdMap;
  preview: AdminEffectPreview;
  previewImagePath: string | null;
  previewImageRevision: number | null;
  updatedAt: string;
};

export type AdminFireworkDetail = AdminFireworkSummary & {
  /** Firework-level renderer overrides, design-shaped, merged over the effect. */
  renderOverridesJson: Json;
  /** The base effect's `model_json`, used to compose the live preview. */
  effectModelJson: Json;
  effectStarStyleDefault: AdminStyleDefaultOption | null;
  effectTrailStyleDefault: AdminStyleDefaultOption | null;
  fireworkStarStyleDefault: AdminStyleDefaultOption | null;
  fireworkTrailStyleDefault: AdminStyleDefaultOption | null;
  effectStyleDefaultLinks: AdminStyleDefaultLinkMap;
  fireworkStyleDefaultLinks: AdminStyleDefaultLinkMap;
  styleDefaults: AdminStyleDefaultOptions;
  /** Every base effect, for the "base effect" selector. */
  effectOptions: AdminEffectOption[];
  /** Map of effect id to its `model_json`, so the preview updates when the base
   *  effect changes without a round-trip. */
  effectModels: Record<string, Json>;
  effectStarStyleDefaults: Record<string, AdminStyleDefaultOption | null>;
  effectTrailStyleDefaults: Record<string, AdminStyleDefaultOption | null>;
  effectStyleDefaultLinksByEffect: Record<string, AdminStyleDefaultLinkMap>;
  history: AdminEditorVersion[];
};

/** A firework that can be placed inside a multishot timeline. */
export type AdminMultishotFireworkOption = {
  id: string;
  slug: string;
  name: string;
  primaryColor: string | null;
  effectName: string | null;
};

/** One placed firework inside a multishot. Appearance is locked; only timing
 *  and aim are editable. */
export type AdminMultishotShot = {
  id: string;
  sequenceIndex: number;
  timeOffsetSeconds: number;
  panDegrees: number;
  tiltDegrees: number;
  launchPositionIndex: number;
  caliber: string | null;
  notes: string | null;
  fireworkId: string | null;
  fireworkName: string | null;
  fireworkSlug: string | null;
  primaryColor: string | null;
  effectName: string | null;
};

export type AdminMultishotSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  durationSeconds: number | null;
  shotCount: number;
  preview: AdminEffectPreview;
  previewImagePath: string | null;
  previewImageRevision: number | null;
  updatedAt: string;
};

export type AdminMultishotDetail = AdminMultishotSummary & {
  shots: AdminMultishotShot[];
  fireworkOptions: AdminMultishotFireworkOption[];
};

export type ShowTemplateCue = {
  timeSeconds: number;
  description: string;
  fireworkSlug?: string;
  catalogueItemId?: string | null;
  catalogueItemSlug?: string | null;
  launchPositionIndex: number;
  emphasis: 'normal' | 'accent' | 'peak';
};

export type ShowTemplate = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  description: string | null;
  durationSeconds: number | null;
  budgetCents: number | null;
  totalCents: number;
  effectsCount: number;
  timeOfDay: string | null;
  moodTags: string[];
  previewCues: ShowTemplateCue[];
  coverShader: ShowCover | null;
  /** Storage path of the pre-rendered cover PNG in the covers bucket; null until rendered. */
  coverImagePath: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  sortOrder: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminShowPresetSummary = ShowTemplate & {
  sourceShowId: string | null;
  cueCount: number;
  resolvableCueCount: number;
};

export type AdminShowPresetCatalogueItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  durationSeconds: number | null;
  shotCount: number | null;
  kind: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorPalette: string[];
  effectName: string | null;
};

export type AdminShowPresetImportShow = {
  id: string;
  slug: string;
  title: string;
  ownerEmail: string | null;
  durationSeconds: number | null;
  effectsCount: number;
  totalCents: number;
  updatedAt: string;
};

export type AdminShowPresetDetail = AdminShowPresetSummary & {
  catalogueItems: AdminShowPresetCatalogueItem[];
  importableShows: AdminShowPresetImportShow[];
};
