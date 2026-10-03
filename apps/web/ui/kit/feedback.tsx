/** Status surfaces adapted from shadcn alerts, progress, skeletons and empty states. */
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Semantic status tone shared across feedback and badges. */
export type Tone = 'info' | 'warning' | 'success' | 'danger' | 'neutral';
const tones: Record<Tone, string> = {
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-highlight-soft text-highlight-foreground',
  danger: 'bg-destructive-soft text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};
/** Displays an explanation with optional action; urgent errors are announced. */
export function Callout({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === 'success' ? CheckCircle : Info;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cn(
        'flex items-start gap-(--card-gap) rounded-lg border border-current/20 px-(--card-padding) py-3 text-sm',
        tones[tone],
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <b className="font-semibold">{title}</b>
        <div className="text-muted-foreground mt-0.5">{children}</div>
      </div>
      {action}
    </div>
  );
}
/** Shows progress as a bounded percentage from 0 to 100. */
export function Progress({ value, label }: { value: number; label: string }) {
  // ARIA percentages use 100 as the whole; clamp caller progress to that range.
  const whole = 100;
  const bounded = Math.min(whole, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={whole}
      aria-valuenow={bounded}
      className="bg-muted h-1.5 overflow-hidden rounded-full"
    >
      <div
        className="bg-highlight h-full rounded-full transition-[width] motion-reduce:transition-none"
        style={{ width: `${String(bounded)}%` }}
      />
    </div>
  );
}
/** Reserves layout while data loads; animation stops under reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-muted animate-pulse rounded-md motion-reduce:animate-none', className)}
    />
  );
}
/** Announces pending work without requiring an animated indicator. */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="text-muted-foreground inline-flex items-center gap-2 text-sm">
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
      {label}
    </span>
  );
}
/** Provides an empty or failure state with a recovery action. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-border-strong grid justify-items-center gap-2 rounded-lg border border-dashed px-4 py-9 text-center">
      <AlertCircle className="text-muted-foreground size-6" />
      <b className="text-sm">{title}</b>
      <div className="text-muted-foreground text-sm">{children}</div>
      {action}
    </div>
  );
}
/** Labels a compact state with a semantic tone. */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[22px] items-center rounded-full px-2 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
