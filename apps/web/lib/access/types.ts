/** Access and profile types shared across server and client boundaries. */

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
  | 'admin.manage_assortments'
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
