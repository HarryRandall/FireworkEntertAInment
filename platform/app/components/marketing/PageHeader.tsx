import type { ReactNode } from "react";
import { Container } from "@/app/components/ui/Container";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  highlight?: string;
  subtitle?: ReactNode;
  align?: "center" | "left";
  children?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  highlight,
  subtitle,
  align = "center",
  children,
}: PageHeaderProps) {
  const alignClass = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <section className="relative isolate overflow-hidden border-b border-outline-variant/15 bg-background pb-20 pt-28 lg:pb-24 lg:pt-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <Container className={`relative z-10 flex flex-col ${alignClass}`}>
        {eyebrow ? (
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary backdrop-blur-md">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            {eyebrow}
          </span>
        ) : null}
        <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-on-surface md:text-6xl">
          {title}
          {highlight ? (
            <>
              {" "}
              <span className="bg-gradient-to-br from-primary-fixed via-primary to-primary-container bg-clip-text text-transparent">
                {highlight}
              </span>
            </>
          ) : null}
        </h1>
        {subtitle ? (
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-on-surface-variant md:text-xl">
            {subtitle}
          </p>
        ) : null}
        {children ? <div className="mt-10">{children}</div> : null}
      </Container>
    </section>
  );
}
