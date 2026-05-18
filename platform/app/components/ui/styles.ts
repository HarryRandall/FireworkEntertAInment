import { cn } from "@/lib/utils";

/**
 * Minimal shared style fragments. Most variant logic now lives on the
 * individual primitives via class-variance-authority. This file is kept
 * only for the few cross-cutting class strings still referenced by
 * legacy app/admin pages — sweep them onto primitives over time.
 */
export const uiStyles = {
  focus: {
    action: "focus:outline-none focus-visible:outline-none",
    field: "focus:outline-none focus-visible:outline-none focus:border-[color:var(--color-content-emphasis)]",
    fieldGroup: "focus-within:border-[color:var(--color-content-emphasis)]",
  },
  control: {
    base:
      "h-10 w-full rounded-md border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] px-3 text-sm text-[color:var(--color-content-emphasis)] transition-colors placeholder:text-[color:var(--color-content-muted)] disabled:cursor-not-allowed disabled:opacity-60",
    select:
      "h-10 w-full cursor-pointer rounded-md border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] px-3 text-sm text-[color:var(--color-content-emphasis)] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    invalid: "border-[color:var(--color-status-danger)] focus:border-[color:var(--color-status-danger)]",
    icon: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[color:var(--color-content-subtle)]",
  },
  text: {
    label:
      "text-sm font-medium text-[color:var(--color-content-emphasis)]",
    hint: "text-sm text-[color:var(--color-content-subtle)]",
    error: "text-sm text-[color:var(--color-status-danger)]",
    metadata:
      "font-mono text-xs tabular-nums text-[color:var(--color-content-subtle)]",
  },
  surface: {
    panel:
      "rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)]",
    elevated:
      "rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] shadow-[var(--shadow-card)]",
    popover:
      "rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-1 shadow-[var(--shadow-modal)]",
    empty:
      "rounded-xl border border-dashed border-[color:var(--color-border-default)] bg-[color:var(--color-bg-muted)] p-8 text-center text-sm text-[color:var(--color-content-subtle)]",
  },
  layer: {
    popover: "z-50",
  },
  action: {
    iconButton:
      "inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-default)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-none",
    navBase:
      "flex h-8 items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors focus:outline-none focus-visible:outline-none",
    navActive:
      "bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent)]",
    navInactive:
      "text-[color:var(--color-content-default)] hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)]",
  },
  table: {
    shell:
      "overflow-hidden rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)]",
    caption:
      "border-b border-[color:var(--color-border-subtle)] px-4 py-3 text-sm font-medium text-[color:var(--color-content-default)]",
    head: "sticky top-0 z-10 bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-subtle)]",
    headerCell: "px-4 py-2.5 text-xs font-medium uppercase tracking-wide",
    row:
      "border-t border-[color:var(--color-border-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)]",
    cell: "px-4 py-3 align-middle text-sm text-[color:var(--color-content-default)]",
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
