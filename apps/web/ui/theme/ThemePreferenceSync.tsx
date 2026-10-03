'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export type ThemePreference = 'light' | 'dark' | 'system';

export function ThemePreferenceSync({
  themePreference,
}: {
  themePreference?: ThemePreference | null;
}) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!themePreference || window.localStorage.getItem('theme')) return;
    setTheme(themePreference);
  }, [setTheme, themePreference]);

  return null;
}
