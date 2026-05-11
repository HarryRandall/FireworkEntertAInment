"use client";

import { useEffect, useState } from "react";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/platform.types";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Moon;
}[] = [
  {
    value: "dark",
    label: "Dark",
    description: "Layered black workspace",
    icon: Moon,
  },
  {
    value: "light",
    label: "Light",
    description: "Bright production view",
    icon: Sun,
  },
  {
    value: "system",
    label: "System",
    description: "Match this device",
    icon: Laptop,
  },
];

export function ThemePreferenceField({
  initialTheme,
}: {
  initialTheme: ThemePreference;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<ThemePreference>(initialTheme);

  useEffect(() => {
    setMounted(true);
    if (theme === "dark" || theme === "light" || theme === "system") {
      setSelected(theme);
    }
  }, [theme]);

  function chooseTheme(value: ThemePreference) {
    setSelected(value);
    setTheme(value);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
        Interface theme
      </legend>
      <input type="hidden" name="themePreference" value={selected} />
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = mounted ? selected === option.value : initialTheme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => chooseTheme(option.value)}
              className={cn(
                "focus-glow-action flex min-h-24 flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all focus:outline-none focus-visible:outline-none",
                active
                  ? "border-primary/50 bg-surface-container-high text-on-surface shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_18%,transparent),0_18px_48px_-34px_color-mix(in_srgb,var(--color-primary)_68%,transparent)]"
                  : "border-outline-variant/55 bg-surface text-on-surface-variant hover:border-outline hover:bg-surface-container-low",
              )}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <Icon size={18} className={active ? "text-on-surface" : ""} />
                {active ? <Check size={16} className="text-primary" /> : null}
              </span>
              <span>
                <span className="block text-sm font-bold text-on-surface">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs leading-relaxed">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
