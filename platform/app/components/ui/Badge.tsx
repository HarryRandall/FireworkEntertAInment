import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal status badge. Use sparingly — only when the status is
 * non-obvious from context (e.g. show state, import state).
 */
type Tone =
  | "neutral"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "accent"
  // Legacy tones — kept so existing call sites compile during the page sweep.
  | "primary"
  | "live"
  | "wow";

const dotClasses: Record<Tone, string> = {
  neutral: "bg-[color:var(--color-content-muted)]",
  success: "bg-[color:var(--color-status-success)]",
  danger: "bg-[color:var(--color-status-danger)]",
  warning: "bg-[color:var(--color-status-warning)]",
  info: "bg-[color:var(--color-status-info)]",
  accent: "bg-[color:var(--color-accent)]",
  primary: "bg-[color:var(--color-content-emphasis)]",
  live: "bg-[color:var(--color-status-success)]",
  wow: "bg-[color:var(--color-accent)]",
};

type BadgeProps = {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-content-default)]",
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClasses[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}

/**
 * Legacy shims — kept so existing imports don't break during the page sweep.
 * Both render as a minimal Badge; remove imports as you sweep each page.
 */
export function ChoiceChip({
  selected = false,
  className,
  children,
  ...rest
}: React.ComponentPropsWithoutRef<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]",
        selected
          ? "border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]"
          : "border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-default)] hover:bg-[color:var(--color-bg-muted)]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  tone?: "primary" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "block text-xs font-medium uppercase tracking-wide text-[color:var(--color-content-subtle)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
