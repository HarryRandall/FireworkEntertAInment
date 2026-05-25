/** Status badge / chip / eyebrow primitives — use Badge for status, ChoiceChip for filters, Eyebrow for section labels. */
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
  // Legacy tones — kept so existing call sites compile during the page sweep.
  | 'primary'
  | 'live'
  | 'wow';

const dotClasses: Record<Tone, string> = {
  neutral: 'bg-[color:var(--color-content-muted)]',
  success: 'bg-[color:var(--color-status-success)]',
  danger: 'bg-[color:var(--color-status-danger)]',
  warning: 'bg-[color:var(--color-status-warning)]',
  info: 'bg-[color:var(--color-status-info)]',
  accent: 'bg-[color:var(--color-accent)]',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  'amber-soft': 'bg-amber-500',
  primary: 'bg-[color:var(--color-content-emphasis)]',
  live: 'bg-[color:var(--color-status-success)]',
  wow: 'bg-[color:var(--color-accent)]',
};

// Coloured pill chips — Dub StatusBadge pattern: tinted subtle background,
// saturated tone-coloured text, leading tone icon. Uses explicit color-mix so
// the background opacity renders reliably on every theme. Applied when `solid` is true.
const solidClasses: Record<Tone, string> = {
  neutral:
    'border-transparent bg-[color-mix(in_srgb,var(--color-content-muted)_18%,transparent)] text-[color:var(--color-content-default)]',
  success:
    'border-transparent bg-[color-mix(in_srgb,var(--color-status-success)_18%,transparent)] text-[color:var(--color-status-success)]',
  danger:
    'border-transparent bg-[color-mix(in_srgb,var(--color-status-danger)_18%,transparent)] text-[color:var(--color-status-danger)]',
  warning:
    'border-transparent bg-[color-mix(in_srgb,var(--color-status-warning)_18%,transparent)] text-[color:var(--color-status-warning)]',
  info: 'border-transparent bg-[color-mix(in_srgb,var(--color-status-info)_18%,transparent)] text-[color:var(--color-status-info)]',
  accent:
    'border-transparent bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] text-[color:var(--color-accent-emphasis)]',
  violet: 'border-transparent bg-violet-500/18 text-violet-700 dark:text-violet-300',
  sky: 'border-transparent bg-sky-500/18 text-sky-700 dark:text-sky-300',
  'amber-soft': 'border-transparent bg-amber-500/18 text-amber-700 dark:text-amber-300',
  primary:
    'border-transparent bg-[color-mix(in_srgb,var(--color-content-emphasis)_18%,transparent)] text-[color:var(--color-content-emphasis)]',
  live: 'border-transparent bg-[color-mix(in_srgb,var(--color-status-success)_18%,transparent)] text-[color:var(--color-status-success)]',
  wow: 'border-transparent bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] text-[color:var(--color-accent-emphasis)]',
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
        solid
          ? solidClasses[tone]
          : 'border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-default)]',
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

/**
 * Legacy shims — kept so existing imports don't break during the page sweep.
 * Both render as a minimal Badge; remove imports as you sweep each page.
 */
type ChoiceChipSize = 'sm' | 'md';

const chipSizeClasses: Record<ChoiceChipSize, string> = {
  sm: 'h-7 gap-1.5 rounded-md px-2.5 text-xs',
  md: 'h-8 gap-2 rounded-md px-3 text-sm',
};

/** Toggleable chip used for inline single-select filters. */
export function ChoiceChip({
  selected = false,
  size = 'sm',
  className,
  children,
  ...rest
}: React.ComponentPropsWithoutRef<'button'> & {
  selected?: boolean;
  size?: ChoiceChipSize;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center border font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]',
        chipSizeClasses[size],
        selected
          ? 'border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]'
          : 'border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-default)] hover:bg-[color:var(--color-bg-muted)]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
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
        'block text-xs font-medium tracking-wide text-[color:var(--color-content-subtle)] uppercase',
        className,
      )}
    >
      {children}
    </span>
  );
}
