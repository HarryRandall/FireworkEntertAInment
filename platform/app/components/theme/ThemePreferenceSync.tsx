"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import type { ThemePreference } from "@/lib/admin.types";

export function ThemePreferenceSync({
  themePreference,
}: {
  themePreference?: ThemePreference | null;
}) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!themePreference) return;
    if (window.localStorage.getItem("theme")) return;
    setTheme(themePreference);
  }, [setTheme, themePreference]);

  return null;
}
