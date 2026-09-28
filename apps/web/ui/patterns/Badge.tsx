import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Info,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Minimal status badge. Use sparingly — only when the status is
 * non-obvious from context (e.g. show state, import state).
 */
type Tone =
  | 'neutral'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'accent'
  | 'violet'
  | 'sky'
  | 'amber-soft'
  | 'primary'
  | 'live'
  | 'wow';

const dotClasses: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-status-success',
  danger: 'bg-destructive',
  warning: 'bg-status-warning',
  info: 'bg-status-info',
  accent: 'bg-primary',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  'amber-soft': 'bg-amber-500',
  primary: 'bg-primary',
  live: 'bg-status-success',
  wow: 'bg-primary',
};

// Status colours pair with tested subtle surfaces. Brand/category chips keep
// their tinted fills and readable foregrounds in both themes.
const solidClasses: Record<Tone, string> = {
  neutral: 'border-transparent bg-secondary text-foreground',
  success: 'border-transparent bg-status-success-subtle text-status-success',
  danger: 'border-transparent bg-status-danger-subtle text-status-danger',
  warning: 'border-transparent bg-status-warning-subtle text-status-warning',
  info: 'border-transparent bg-status-info-subtle text-status-info',
  accent:
    'border-transparent bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-foreground',
  violet: 'border-transparent bg-violet-500/18 text-violet-700 dark:text-violet-300',
  sky: 'border-transparent bg-sky-500/18 text-sky-700 dark:text-sky-300',
  'amber-soft': 'border-transparent bg-amber-500/18 text-amber-700 dark:text-amber-300',
  primary:
    'border-transparent bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-foreground',
  live: 'border-transparent bg-status-success-subtle text-status-success',
  wow: 'border-transparent bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-foreground',
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const toneIcons: Record<Tone, IconComponent> = {
  neutral: CircleDashed,
  success: CircleCheck,
  danger: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  accent: Sparkles,
  violet: CircleDot,
  sky: Info,
  'amber-soft': TriangleAlert,
  primary: CircleDot,
  live: CircleCheck,
  wow: Sparkles,
};

type BadgeProps = {
  tone?: Tone;
  dot?: boolean;
  solid?: boolean;
  icon?: IconComponent | null;
  className?: string;
  children: ReactNode;
};

/** Status pill with tone + optional icon. */
export function Badge({
  tone = 'neutral',
  dot = false,
  solid = false,
  icon,
  className,
  children,
}: BadgeProps) {
  const Icon = icon === null ? null : (icon ?? (solid ? toneIcons[tone] : null));
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        solid ? solidClasses[tone] : 'border-border bg-background text-foreground',
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn('inline-block h-1.5 w-1.5 rounded-full', dotClasses[tone])}
        />
      ) : Icon ? (
        <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
      ) : null}
      {children}
    </span>
  );
}

/** Small uppercase eyebrow label, typically rendered above section titles. */
export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  tone?: 'primary' | 'muted';
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'text-muted-foreground block text-xs font-medium tracking-wide uppercase',
        className,
      )}
    >
      {children}
    </span>
  );
}
