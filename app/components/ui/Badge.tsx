import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "primary" | "neutral" | "success" | "live";

const toneClasses: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  neutral: "bg-surface-container-highest text-on-surface-variant",
  success: "bg-[color-mix(in_srgb,_var(--color-success)_15%,_transparent)] text-[color:var(--color-success)]",
  live: "bg-tertiary/10 text-tertiary",
};

type BadgeProps = {
  tone?: Tone;
  className?: string;
  children: ReactNode;
};

export function Badge({ tone = "primary", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
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
