/** Primary button primitive (CVA variants) — use for all clickable actions and links rendered as buttons. */
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)] disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)] hover:bg-[color:var(--color-bg-inverted)] hover:ring-4 hover:ring-[color:var(--color-bg-subtle)]',
        secondary:
          'border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-emphasis)] hover:bg-[color:var(--color-bg-muted)]',
        ghost:
          'border-transparent bg-transparent text-[color:var(--color-content-default)] hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)]',
        accent:
          'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-on-accent)] hover:bg-[color:var(--color-accent-hover)] hover:ring-4 hover:ring-[color:var(--color-accent-subtle)]',
        destructive:
          'border-[#dc2626] bg-[#dc2626] text-white hover:bg-[#b91c1c] hover:border-[#b91c1c] hover:ring-4 hover:ring-[#dc2626]/15',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

type CommonProps = VariantProps<typeof button> & {
  children: ReactNode;
  className?: string;
  loading?: boolean;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children'> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, 'className' | 'children' | 'href'> & {
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className, children, loading = false } = props;
  const classes = cn(button({ variant, size }), className);

  if ('href' in props && props.href !== undefined) {
    const {
      href,
      variant: _v,
      size: _s,
      className: _c,
      children: _ch,
      loading: _l,
      ...rest
    } = props;
    void _v;
    void _s;
    void _c;
    void _ch;
    void _l;
    return (
      <Link href={href} aria-disabled={loading || undefined} className={classes} {...rest}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {children}
      </Link>
    );
  }

  const {
    variant: _v,
    size: _s,
    className: _c,
    children: _ch,
    loading: _l,
    disabled,
    type = 'button',
    ...rest
  } = props as ButtonAsButton;
  void _v;
  void _s;
  void _c;
  void _ch;
  void _l;
  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
