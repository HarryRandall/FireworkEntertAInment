'use client';

/** Product actions add link and loading behaviour to the shared UI button variants. */
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/lib/utils';

const variants = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
  accent: 'secondary',
  destructive: 'destructive',
} as const satisfies Record<string, NonNullable<VariantProps<typeof buttonVariants>['variant']>>;

const sizes = {
  sm: 'h-8 px-3',
  md: 'h-10 px-4',
  lg: 'h-12 px-6',
  icon: 'h-10 w-10',
} as const;

type CommonProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
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
  const classes = cn(
    buttonVariants({ variant: variants[variant], size: null }),
    'cursor-pointer gap-2 duration-150 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0',
    sizes[size],
    variant === 'ghost' && 'text-muted-foreground',
    className,
  );

  if (props.href !== undefined) {
    const {
      href,
      variant: _v,
      size: _s,
      className: _c,
      children: _ch,
      loading: _l,
      onClick,
      'aria-busy': ariaBusy,
      'aria-disabled': ariaDisabled,
      ...rest
    } = props;
    void _v;
    void _s;
    void _c;
    void _ch;
    void _l;
    const isDisabled = loading || ariaDisabled === true || ariaDisabled === 'true';
    return (
      <Link
        href={href}
        aria-busy={loading ? true : ariaBusy}
        aria-disabled={isDisabled || undefined}
        className={classes}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
        {...rest}
      >
        {loading ? (
          <Loader2 aria-hidden size={16} className="animate-spin motion-reduce:animate-none" />
        ) : null}
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
    'aria-busy': ariaBusy,
    ...rest
  } = props;
  void _v;
  void _s;
  void _c;
  void _ch;
  void _l;
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading ? true : ariaBusy}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden size={16} className="animate-spin motion-reduce:animate-none" />
      ) : null}
      {children}
    </button>
  );
}
