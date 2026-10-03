'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export type ThemePreference = 'light' | 'dark' | 'system';

/** Applies the account preference when no local browser preference is saved. */
export function ThemePreferenceSync({
  themePreference,
}: {
  themePreference?: ThemePreference | null;
}) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (
      themePreference === null ||
      themePreference === undefined ||
      (window.localStorage.getItem('theme') ?? '').length > 0
    )
      return;
    setTheme(themePreference);
  }, [setTheme, themePreference]);

  return null;
}
