import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { uiStyles } from "@/app/components/ui/styles";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-200 ease-out cursor-pointer active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0";

const variantClasses: Record<Variant, string> = {
  primary:
    "border border-primary/70 bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)] hover:brightness-105",
  secondary:
    "border border-outline-variant/55 bg-surface text-on-surface hover:border-primary/45 hover:bg-surface-container-high",
  ghost:
    "border border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  destructive:
    "border border-error/70 bg-error text-on-error hover:brightness-105",
};

const sizeClasses: Record<Size, string> = {
  sm: "min-h-9 px-5 text-sm",
  md: "min-h-11 px-8 text-sm",
  lg: "min-h-14 px-10 text-base",
  icon: "h-11 w-11 p-0",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
  loading?: boolean;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "className" | "children" | "href"> & {
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    className,
    children,
    loading = false,
  } = props;
  const classes = cn(
    uiStyles.focus.action,
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if ("href" in props && props.href !== undefined) {
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
      <Link href={href} className={classes} {...rest}>
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
    ...rest
  } = props as ButtonAsButton;
  void _v;
  void _s;
  void _c;
  void _ch;
  void _l;
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
