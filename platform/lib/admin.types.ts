export type RoleKey = "admin" | "supplier" | "user";

export type PermissionKey =
  | "shows.create"
  | "admin.view"
  | "admin.manage_users"
  | "admin.manage_suppliers"
  | "admin.manage_catalogue"
  | "admin.manage_imports"
  | "supplier.view"
  | "supplier.manage_stock";

export type ProfileStatus = "active" | "suspended";
export type ThemePreference = "dark" | "light" | "system";

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
