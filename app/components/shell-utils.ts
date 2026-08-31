/** Small helpers shared by the app and admin shell chrome. */

import type { MouseEvent } from 'react';
import type { ThemePreference } from '@/lib/admin.types';

export const SIDEBAR_BRAND_BUTTON_CLASS =
  'text-on-surface h-10 overflow-visible bg-transparent shadow-none transition-[background-color] duration-150 hover:bg-sidebar-accent hover:text-on-surface hover:shadow-none active:bg-sidebar-accent active:text-on-surface data-active:bg-sidebar-accent data-active:text-on-surface data-open:bg-sidebar-accent data-open:text-on-surface data-open:hover:bg-sidebar-accent data-open:hover:text-on-surface [&_svg.brand-logo-mark]:size-10! group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:group-hover/brand:opacity-0 group-data-[collapsible=icon]:[&_svg.brand-logo-mark]:size-8!';

/** Narrow a persisted string to a known theme preference. */
export function isThemePreference(value: string | undefined): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

/**
 * True for an unmodified left click, so navigation handlers can run without
 * breaking new-tab/window shortcuts and middle clicks.
 */
export function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
  );
}
