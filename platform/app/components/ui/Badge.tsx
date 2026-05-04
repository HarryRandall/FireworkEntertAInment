import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { Toggle as ShadcnToggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

type Tone = "primary" | "neutral" | "success" | "live" | "danger" | "wow";

const toneClasses: Record<Tone, string> = {
  primary: "border border-primary/25 bg-primary/10 text-primary",
  neutral:
    "border border-outline-variant/45 bg-surface-container-highest/80 text-on-surface-variant",
  success:
    "border border-success/25 bg-[color-mix(in_srgb,_var(--color-success)_14%,_transparent)] text-[color:var(--color-success)]",
  live: "border border-secondary/25 bg-secondary/10 text-secondary",
  danger:
    "border border-error/25 bg-[color-mix(in_srgb,_var(--color-error)_14%,_transparent)] text-error",
  wow: "border border-highlight/35 bg-highlight/12 text-highlight",
};

type BadgeProps = {
  tone?: Tone;
  className?: string;
  children: ReactNode;
};

export function Badge({ tone = "primary", className, children }: BadgeProps) {
  return (
    <ShadcnBadge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </ShadcnBadge>
  );
}

type ChoiceChipProps = ComponentPropsWithoutRef<"button"> & {
  selected?: boolean;
};

export function ChoiceChip({
  selected = false,
  className,
  children,
  ...rest
}: ChoiceChipProps) {
  return (
    <ShadcnToggle
      type="button"
      pressed={selected}
      variant="outline"
      className={cn(
        "focus-glow-action inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full border px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:outline-none",
        selected
          ? "border-primary/60 bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)]"
          : "border-outline-variant/55 bg-surface-container-low text-on-surface-variant hover:border-primary/40 hover:bg-surface-container-high hover:text-on-surface",
        className,
      )}
      {...rest}
    >
      {children}
    </ShadcnToggle>
  );
}

type EyebrowProps = {
  className?: string;
  tone?: "primary" | "muted";
  children: ReactNode;
};

export function Eyebrow({
  className,
  tone = "primary",
  children,
}: EyebrowProps) {
  return (
    <span
      className={cn(
        "block text-xs font-bold uppercase tracking-[0.2em]",
        tone === "primary" ? "text-primary" : "text-on-surface-variant",
        className,
      )}
    >
      {children}
    </span>
  );
}
