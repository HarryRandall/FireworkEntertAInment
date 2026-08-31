export const sidebarCollapsedStorageKey = 'showcrafter:sidebar-collapsed';
export const sidebarCollapsedCookieName = 'showcrafter_sidebar_collapsed';
export const sidebarCollapsedCookieMaxAge = 60 * 60 * 24 * 365;

export function parseSidebarCollapsedPreference(value: string | null | undefined) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}
