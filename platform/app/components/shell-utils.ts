/** Small helpers shared by the app and admin shell chrome. */

import type { MouseEvent } from 'react';
import type { ThemePreference } from '@/lib/admin.types';

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
