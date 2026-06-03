/** Feedback primitives: InlineAlert / EmptyState / Skeleton / ProgressIndicator for status surfaces and loading states. */
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton as ShadcnSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';
type AlertSize = 'default' | 'lg';

const alertIconClasses: Record<AlertTone, string> = {
  info: 'text-[color:var(--color-status-info)]',
  success: 'text-[color:var(--color-status-success)]',
  warning: 'text-[color:var(--color-status-warning)]',
  danger: 'text-[color:var(--color-status-danger)]',
};

const alertIcons: Record<AlertTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
};

const alertSizes: Record<
  AlertSize,
  { root: string; icon: string; title: string; body: string; iconSize: number }
> = {
  default: {
    root: 'gap-3 rounded-lg p-4 text-sm',
    icon: 'mt-0.5',
    title: 'font-medium',
    body: 'mt-1 leading-relaxed',
    iconSize: 18,
  },
  lg: {
    root: 'gap-4 rounded-2xl p-6 text-base sm:gap-5 sm:p-8',
    icon: 'mt-1',
    title: 'text-xl font-semibold sm:text-2xl',
    body: 'mt-2 text-base leading-relaxed sm:text-lg',
    iconSize: 30,
  },
};

/** Inline alert banner with info/success/warning/danger tones. */
export function InlineAlert({
  tone = 'info',
  size = 'default',
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  size?: AlertSize;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = alertIcons[tone];
  const sizeClasses = alertSizes[size];
  return (
    <div
      className={cn(
        'flex border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)]',
        sizeClasses.root,
        className,
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon
        className={cn('shrink-0', sizeClasses.icon, alertIconClasses[tone])}
        size={sizeClasses.iconSize}
      />
      <div>
        <p className={cn('text-[color:var(--color-content-emphasis)]', sizeClasses.title)}>
          {title}
        </p>
        {children ? (
          <div className={cn('text-[color:var(--color-content-subtle)]', sizeClasses.body)}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Empty-state block with icon, title, body, and optional CTA. */
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
        'flex flex-col items-center gap-4 rounded-xl border border-dashed border-[color:var(--color-border-default)] bg-[color:var(--color-bg-muted)] p-10 text-center',
        className,
      )}
    >
      {icon ? <span className="text-[color:var(--color-content-muted)]">{icon}</span> : null}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
          {title}
        </h2>
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

/** Thin wrapper around the shadcn Skeleton, use for loading placeholders. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <ShadcnSkeleton className={cn('rounded-md bg-[color:var(--color-bg-subtle)]', className)} />
  );
}

/** Labelled progress bar, use for determinate progress (upload, import jobs). */
export function ProgressIndicator({ label, value }: { label: string; value?: number }) {
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
