import type { Json } from '@/lib/database.types';

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
  | 'admin.manage_suppliers'
  | 'admin.manage_catalogue'
  | 'admin.manage_imports'
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
  approvedProductId: string | null;
  approvedFireworkSpecificationId: string | null;
  rowCount: number | null;
  errorMessage: string | null;
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
  fireworkSpecificationId: string | null;
  durationSeconds: number | null;
  updatedAt: string;
};

export type AdminEffectPreview = {
  colors: string[];
  label: string;
  pattern: string | null;
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
  family: string;
  patternKey: string;
  source: string;
  sortOrder: number;
  variantCount: number;
  preview: AdminEffectPreview;
  updatedAt: string;
};

export type AdminEffectDetail = AdminEffectSummary & {
  modelJson: Json;
};

export type AdminFireworkSummary = {
  id: string;
  partNumber: string;
  name: string;
  manufacturer: string | null;
  productKind: string;
  fireworkType: string | null;
  description: string | null;
  durationSeconds: number | null;
  shotCount: number;
  calibers: string[];
  effectNames: string[];
  effectTypes: string[];
  preview: AdminEffectPreview;
  effects: {
    id: string;
    slug: string;
    name: string;
    type: string;
    durationSeconds: number;
    heightMeters: number | null;
  }[];
  updatedAt: string;
};

export type AdminFireworkShot = {
  id: string;
  shotIndex: number;
  timeOffsetSeconds: number;
  panDegrees: number;
  tiltDegrees: number;
  caliber: string | null;
  notes: string | null;
  variantId: string | null;
  effectSpecId: string | null;
  variantName: string | null;
  variantSlug: string | null;
  primaryColor: string | null;
  baseEffectName: string | null;
};

export type AdminFireworkVariantOption = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string | null;
  baseEffectName: string;
  sourceEffectSpecId: string | null;
};

export type AdminFireworkDetail = AdminFireworkSummary & {
  productMetadata: Json;
  shots: AdminFireworkShot[];
  variantOptions: AdminFireworkVariantOption[];
};

export type ShowTemplateCue = {
  timeSeconds: number;
  description: string;
  fireworkSlug: string;
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
  isFeatured: boolean;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
};
