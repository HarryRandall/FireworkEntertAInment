'use client';

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react';
import type { ThemePreference } from '@/lib/admin.types';
import { cn } from '@/lib/utils';
import { SkipLink } from '@/ui/patterns/SkipLink';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/ui/primitives/sidebar';
import { ThemePreferenceSync } from '@/ui/theme/ThemePreferenceSync';
import { useSidebarPreference } from './useSidebarPreference';

export function WorkspaceShell({
  children,
  themePreference,
  initialSidebarCollapsed = false,
  hasInitialSidebarCollapsedCookie = false,
  sidebarWidth = 60,
}: {
  children: ReactNode;
  themePreference?: ThemePreference | null;
  initialSidebarCollapsed?: boolean;
  hasInitialSidebarCollapsedCookie?: boolean;
  sidebarWidth?: 60 | 64;
}) {
  const { sidebarCollapsed, sidebarTransitionReady, setSidebarCollapsedPreference } =
    useSidebarPreference({
      initialCollapsed: initialSidebarCollapsed,
      hasInitialCookie: hasInitialSidebarCollapsedCookie,
    });

  return (
    <SidebarProvider
      defaultOpen={!initialSidebarCollapsed}
      open={!sidebarCollapsed}
      onOpenChange={(open) => setSidebarCollapsedPreference(!open)}
      className={cn(
        'bg-sidebar text-sidebar-foreground h-svh overflow-hidden font-sans',
        !sidebarTransitionReady && '[&_*]:!transition-none',
      )}
      style={{ '--sidebar-width': `calc(var(--spacing) * ${sidebarWidth})` } as CSSProperties}
    >
      <ThemePreferenceSync themePreference={themePreference} />
      <SkipLink />
      {children}
    </SidebarProvider>
  );
}

export function WorkspaceHeader({
  children,
  navigationLabel,
}: {
  children: ReactNode;
  navigationLabel: string;
}) {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/85 border-border flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur sm:px-6">
      <SidebarTrigger className="shrink-0 md:hidden" aria-label={navigationLabel} />
      {children}
    </header>
  );
}

export function WorkspaceContent({
  children,
  header,
  className,
  insetClassName,
  ...props
}: ComponentPropsWithoutRef<'main'> & {
  header: ReactNode;
  insetClassName?: string;
  'data-app-content'?: boolean;
}) {
  return (
    <SidebarInset
      className={cn(
        'bg-background md:peer-data-[variant=inset]:border-border h-svh min-h-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:max-h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:border',
        insetClassName,
      )}
    >
      {header}
      <main
        {...props}
        id="main-content"
        tabIndex={-1}
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 focus:outline-none sm:px-8 lg:px-10',
          className,
        )}
      >
        {children}
      </main>
    </SidebarInset>
  );
}
