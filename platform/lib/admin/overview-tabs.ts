export const ADMIN_OVERVIEW_TAB_PARAM = 'tab';

export const ADMIN_OVERVIEW_TAB_OPTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'catalogue', label: 'Catalogue' },
  { key: 'imports', label: 'Imports' },
  { key: 'generation', label: 'Generation' },
] as const;

export type AdminOverviewTabOption = (typeof ADMIN_OVERVIEW_TAB_OPTIONS)[number];
export type AdminOverviewTabKey = AdminOverviewTabOption['key'];

export const DEFAULT_ADMIN_OVERVIEW_TAB_KEY: AdminOverviewTabKey = 'overview';

const tabOptionsByKey = new Map<AdminOverviewTabKey, AdminOverviewTabOption>(
  ADMIN_OVERVIEW_TAB_OPTIONS.map((option) => [option.key, option]),
);

export function getAdminOverviewTabOption(key: string | null | undefined): AdminOverviewTabOption {
  return (
    tabOptionsByKey.get(key as AdminOverviewTabKey) ??
    tabOptionsByKey.get(DEFAULT_ADMIN_OVERVIEW_TAB_KEY)!
  );
}

export function parseAdminOverviewTab(
  value: string | string[] | null | undefined,
): AdminOverviewTabOption {
  return getAdminOverviewTabOption(Array.isArray(value) ? value[0] : value);
}
