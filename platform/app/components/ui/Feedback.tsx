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
        'border-border bg-card text-card-foreground flex border shadow-xs',
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
        <p className={cn('text-foreground', sizeClasses.title)}>{title}</p>
        {children ? (
          <div className={cn('text-muted-foreground', sizeClasses.body)}>{children}</div>
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
        'border-border bg-muted/50 flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center',
        className,
      )}
    >
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <div className="space-y-1">
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
        {children ? (
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{children}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Lightweight dashed empty message for sections that have no rows yet. Use EmptyState for full-page empties. */
export function EmptyNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'border-border bg-muted/40 text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Thin wrapper around the shadcn Skeleton, use for loading placeholders. */
export function Skeleton({ className }: { className?: string }) {
  return <ShadcnSkeleton className={cn('rounded-md', className)} />;
}

/** Labelled progress bar, use for determinate progress (upload, import jobs). */
export function ProgressIndicator({ label, value }: { label: string; value?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Loader2 size={14} className="animate-spin" />
        {label}
      </div>
      <Progress value={value ?? 42} className="bg-muted [&>div]:bg-primary h-1" />
    </div>
  );
}
