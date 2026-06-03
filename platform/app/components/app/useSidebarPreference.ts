'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import {
  parseSidebarCollapsedPreference,
  sidebarCollapsedCookieMaxAge,
  sidebarCollapsedCookieName,
  sidebarCollapsedStorageKey,
} from '@/lib/sidebar-preference';

const useHydrationLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function readStoredSidebarPreference() {
  try {
    return parseSidebarCollapsedPreference(window.localStorage.getItem(sidebarCollapsedStorageKey));
  } catch {
    return null;
  }
}

function writeStoredSidebarPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(sidebarCollapsedStorageKey, String(collapsed));
  } catch {
    // Ignore storage errors; the control should still work for this session.
  }

  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${sidebarCollapsedCookieName}=${String(collapsed)}; Path=/; Max-Age=${sidebarCollapsedCookieMaxAge}; SameSite=Lax${secure}`;
  } catch {
    // Ignore cookie errors for the same reason.
  }
}

export function useSidebarPreference({
  initialCollapsed,
  hasInitialCookie,
}: {
  initialCollapsed: boolean;
  hasInitialCookie: boolean;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);
  const [sidebarTransitionReady, setSidebarTransitionReady] = useState(false);

  useHydrationLayoutEffect(() => {
    const storedPreference = readStoredSidebarPreference();
    const resolvedPreference = hasInitialCookie
      ? initialCollapsed
      : (storedPreference ?? initialCollapsed);

    setSidebarCollapsed(resolvedPreference);
    writeStoredSidebarPreference(resolvedPreference);

    const frame = window.requestAnimationFrame(() => setSidebarTransitionReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [hasInitialCookie, initialCollapsed]);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      writeStoredSidebarPreference(next);
      return next;
    });
  };

  return { sidebarCollapsed, sidebarTransitionReady, toggleSidebar };
}
