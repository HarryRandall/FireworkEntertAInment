import type { ReactNode } from "react";
import { AlertTriangle, Info, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const alertToneClasses: Record<AlertTone, string> = {
  info: "border-primary/25 bg-primary/10 text-on-surface",
  success: "border-success/25 bg-success/10 text-on-surface",
  warning: "border-highlight/30 bg-highlight/10 text-on-surface",
  danger: "border-error/30 bg-error/10 text-on-surface",
};

export function InlineAlert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = tone === "danger" || tone === "warning" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-4 text-sm",
        alertToneClasses[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 shrink-0 text-primary" size={18} />
      <div>
        <p className="font-bold">{title}</p>
        {children ? (
          <div className="mt-1 leading-relaxed text-on-surface-variant">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border border-outline-variant/45 bg-surface-container-low/80 p-10 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <Sparkles size={22} strokeWidth={1.8} />
      </span>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
        {children ? (
          <p className="max-w-md text-sm leading-relaxed text-on-surface-variant">
            {children}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-surface-container-highest/70",
        className,
      )}
    />
  );
}

export function ProgressIndicator({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
        <Loader2 size={14} className="animate-spin text-primary" />
        {label}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_18px_color-mix(in_srgb,var(--color-primary)_55%,transparent)] transition-all"
          style={{ width: `${Math.max(0, Math.min(100, value ?? 42))}%` }}
        />
      </div>
    </div>
  );
}
