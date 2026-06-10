/** Primary button primitive (CVA variants) - use for all clickable actions and links rendered as buttons. */
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-border bg-background text-foreground shadow-xs hover:bg-muted hover:text-foreground',
        ghost: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/80',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20',
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
