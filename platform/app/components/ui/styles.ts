/** Shared Tailwind class fragments still referenced by legacy pages — prefer per-component variants. */
import { cn } from '@/lib/utils';

/**
 * Minimal shared style fragments. Most variant logic now lives on the
 * individual primitives via class-variance-authority. This file is kept
 * only for the few cross-cutting class strings still referenced by
 * legacy app/admin pages — sweep them onto primitives over time.
 */
export const uiStyles = {
  focus: {
    action:
      'focus:outline-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
    field:
      'focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    fieldGroup: 'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
  },
  control: {
    base: 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60',
    select:
      'h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60',
    invalid:
      'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20',
    icon: 'pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground',
  },
  text: {
    label: 'text-sm font-medium text-foreground',
    hint: 'text-sm text-muted-foreground',
    error: 'text-sm text-destructive',
    metadata: 'font-mono text-xs tabular-nums text-muted-foreground',
  },
  surface: {
    panel: 'rounded-xl border border-border bg-card text-card-foreground',
    elevated: 'rounded-xl border border-border bg-card text-card-foreground shadow-xs',
    popover: 'rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md',
    empty:
      'rounded-xl border border-dashed border-border bg-muted/50 p-8 text-center text-sm text-muted-foreground',
  },
  layer: {
    popover: 'z-50',
  },
  action: {
    iconButton:
      'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
    navBase:
      "relative flex h-8 items-center gap-2 rounded-lg px-2 pl-3 text-sm font-medium transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 before:absolute before:left-1 before:top-1.5 before:h-5 before:w-0.5 before:rounded-full before:bg-transparent before:content-['']",
    navActive: 'bg-accent text-accent-foreground before:bg-primary',
    navInactive: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  },
  table: {
    shell: 'overflow-hidden rounded-xl border border-border bg-card text-card-foreground',
    caption: 'border-b border-border px-4 py-3 text-sm font-medium text-foreground',
    head: 'sticky top-0 z-10 bg-muted text-muted-foreground',
    headerCell: 'px-4 py-2.5 text-xs font-medium uppercase tracking-wide',
    row: 'border-t border-border/50 transition-colors hover:bg-muted/60',
    cell: 'px-4 py-3 align-middle text-sm text-foreground',
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
