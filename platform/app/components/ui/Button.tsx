import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from "react";
import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

type ShadcnVariant = NonNullable<
  ComponentProps<typeof ShadcnButton>["variant"]
>;
type ShadcnSize = NonNullable<
  ComponentProps<typeof ShadcnButton>["size"]
>;

const variantMap: Record<Variant, ShadcnVariant> = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  destructive: "destructive",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 rounded-full px-5 text-sm font-bold",
  md: "h-11 rounded-full px-8 text-sm font-bold",
  lg: "h-14 rounded-full px-10 text-base font-bold",
  icon: "size-11 rounded-full p-0",
};

const variantClasses: Record<Variant, string> = {
  primary:
    "border-primary/70 bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)] hover:brightness-105 hover:bg-primary-container",
  secondary:
    "border-outline-variant/55 bg-surface text-on-surface hover:border-primary/45 hover:bg-surface-container-high hover:text-on-surface",
  ghost:
    "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  destructive:
    "border-error/70 bg-error text-on-error hover:bg-error hover:brightness-105",
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
    sizeClasses[size],
    "cursor-pointer gap-2 transition-all duration-200 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0",
    variantClasses[variant],
    className,
  );
  const shadcnSize: ShadcnSize = size === "icon" ? "icon-lg" : "default";

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
      <ShadcnButton
        asChild
        variant={variantMap[variant]}
        size={shadcnSize}
        className={classes}
      >
        <Link href={href} aria-disabled={loading || undefined} {...rest}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {children}
        </Link>
      </ShadcnButton>
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
    <ShadcnButton
      variant={variantMap[variant]}
      size={shadcnSize}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </ShadcnButton>
  );
}
