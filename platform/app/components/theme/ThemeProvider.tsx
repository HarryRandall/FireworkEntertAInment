'use client';

/**
 * ThemeProvider — wraps the app with next-themes using the
 * `data-theme` attribute. Mounted once in the root layout so both
 * marketing and authenticated routes share the theme context.
 */
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The protected render harness has a nonce-only script policy. It has no
  // interactive theme controls, so avoid next-themes' un-nonced bootstrap
  // script on that isolated machine-to-machine route.
  if (pathname === '/internal/import-render') return children;

  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
