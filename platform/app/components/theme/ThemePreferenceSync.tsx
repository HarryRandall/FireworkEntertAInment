'use client';

/**
 * ThemePreferenceSync — invisible client component mounted inside
 * AppShell/AdminShell that applies the user's stored theme preference
 * (from `profiles.theme_preference`) on first load. Skips when a
 * local override already exists in `localStorage.theme`.
 */
import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import type { ThemePreference } from '@/lib/admin.types';

export function ThemePreferenceSync({
  themePreference,
}: {
  themePreference?: ThemePreference | null;
}) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!themePreference) return;
    if (window.localStorage.getItem('theme')) return;
    setTheme(themePreference);
  }, [setTheme, themePreference]);

  return null;
}
