import { cn } from "@/lib/utils";

export const uiStyles = {
  focus: {
    action:
      "focus-glow-action focus:outline-none focus-visible:outline-none",
    field:
      "focus-glow-field focus:outline-none focus-visible:outline-none",
    fieldGroup: "focus-glow-field-group",
  },
  control: {
    base:
      "h-11 w-full rounded-xl border border-outline/55 bg-surface px-4 text-sm text-on-surface transition-all duration-200 placeholder:text-on-surface-variant/60 disabled:cursor-not-allowed disabled:opacity-60",
    select:
      "h-11 w-full cursor-pointer rounded-xl border border-outline/55 bg-surface px-3 text-sm font-semibold text-on-surface transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
    invalid: "border-error/60",
    icon: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant",
  },
  text: {
    label:
      "text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant",
    hint: "text-sm leading-relaxed text-on-surface-variant",
    error: "text-sm font-semibold text-error",
    metadata:
      "font-mono text-xs tabular-nums text-on-surface-variant",
  },
  surface: {
    panel:
      "rounded-xl border border-outline-variant/55 bg-surface-container-low/88 shadow-[var(--shadow-card)]",
    elevated:
      "rounded-xl border border-outline-variant/55 bg-surface-container-high/92 shadow-[var(--shadow-card)]",
    popover:
      "rounded-xl border border-outline/55 bg-surface p-1.5 shadow-[var(--shadow-modal)]",
    empty:
      "rounded-xl border border-dashed border-outline-variant/35 bg-surface-container-low/70 p-8 text-center text-sm text-on-surface-variant",
  },
  layer: {
    popover: "z-50",
  },
  action: {
    iconButton:
      "focus-glow-action inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/45 bg-surface text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus:outline-none focus-visible:outline-none",
    navBase:
      "focus-glow-action flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all focus:outline-none focus-visible:outline-none",
    navActive:
      "border border-outline bg-surface-container-high text-on-surface shadow-[var(--shadow-card)]",
    navInactive:
      "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  },
  table: {
    shell:
      "overflow-hidden rounded-xl border border-outline-variant/55 bg-surface-container-low/88 shadow-[var(--shadow-card)]",
    caption:
      "border-b border-outline-variant/45 px-4 py-3 text-sm font-semibold text-on-surface-variant",
    head: "sticky top-0 z-10 bg-surface-container-high text-on-surface-variant",
    headerCell: "px-4 py-3 text-xs font-bold uppercase tracking-[0.14em]",
    row:
      "border-t border-outline-variant/30 transition-colors hover:bg-surface-container-high/45 focus-within:bg-surface-container-high/60",
    cell: "px-4 py-3 align-middle",
  },
} as const;

export function fieldControlClasses(className?: string, invalid = false) {
  return cn(
    uiStyles.focus.field,
    uiStyles.control.base,
    invalid && uiStyles.control.invalid,
    className,
  );
}
