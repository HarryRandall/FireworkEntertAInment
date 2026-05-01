"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isLight = mounted && resolvedTheme === "light";

  return (
    <button
      type="button"
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className={`group relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-outline-variant/30 bg-surface-container/60 text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary ${className}`}
    >
      <span className="inline-flex transition-transform duration-200 group-hover:scale-110" aria-hidden>
        {isLight ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
      </span>
    </button>
  );
}
