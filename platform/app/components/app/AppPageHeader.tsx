import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Breadcrumb = {
  label: ReactNode;
  href?: string;
};

type AppPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  className?: string;
};

export function AppPageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: AppPageHeaderProps) {
  return (
    <header
      className={cn(
        "-mx-6 -mt-6 mb-6 border-b border-[color:var(--color-border-subtle)] px-6 py-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10",
        className,
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1 text-sm text-[color:var(--color-content-subtle)]"
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const content = crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-[color:var(--color-content-emphasis)]"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cn(
                  isLast && "text-[color:var(--color-content-emphasis)]",
                )}
              >
                {crumb.label}
              </span>
            );
            return (
              <span key={idx} className="flex items-center gap-1">
                {content}
                {!isLast ? (
                  <ChevronRight size={14} className="text-[color:var(--color-content-muted)]" />
                ) : null}
              </span>
            );
          })}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-7 tracking-tight text-[color:var(--color-content-emphasis)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
