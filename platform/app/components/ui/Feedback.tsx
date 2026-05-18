import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton as ShadcnSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger";

const alertIconClasses: Record<AlertTone, string> = {
  info: "text-[color:var(--color-status-info)]",
  success: "text-[color:var(--color-status-success)]",
  warning: "text-[color:var(--color-status-warning)]",
  danger: "text-[color:var(--color-status-danger)]",
};

const alertIcons: Record<AlertTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
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
  const Icon = alertIcons[tone];
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-4 text-sm",
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon className={cn("mt-0.5 shrink-0", alertIconClasses[tone])} size={18} />
      <div>
        <p className="font-medium text-[color:var(--color-content-emphasis)]">{title}</p>
        {children ? (
          <div className="mt-1 leading-relaxed text-[color:var(--color-content-subtle)]">
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
  icon,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border border-dashed border-[color:var(--color-border-default)] bg-[color:var(--color-bg-muted)] p-10 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="text-[color:var(--color-content-muted)]">{icon}</span>
      ) : null}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">{title}</h2>
        {children ? (
          <p className="max-w-md text-sm leading-relaxed text-[color:var(--color-content-subtle)]">
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
    <ShadcnSkeleton
      className={cn("rounded-md bg-[color:var(--color-bg-subtle)]", className)}
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
      <div className="flex items-center gap-2 text-xs text-[color:var(--color-content-subtle)]">
        <Loader2 size={14} className="animate-spin" />
        {label}
      </div>
      <Progress
        value={value ?? 42}
        className="h-1 bg-[color:var(--color-bg-subtle)] [&>div]:bg-[color:var(--color-accent)]"
      />
    </div>
  );
}
