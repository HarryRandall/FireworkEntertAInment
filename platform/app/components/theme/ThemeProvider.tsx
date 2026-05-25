'use client';

/**
 * ThemeProvider — wraps the app with next-themes using the
 * `data-theme` attribute. Mounted once in the root layout so both
 * marketing and authenticated routes share the theme context.
 */
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
