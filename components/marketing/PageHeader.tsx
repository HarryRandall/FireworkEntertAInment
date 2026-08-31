/**
 * PageHeader - shared hero header for marketing pages (e.g. /pricing,
 * /about). Accepts `eyebrow`, `title`, optional `highlight` span, and
 * `subtitle`. Rendered above page content inside the marketing layout.
 */
import type { ReactNode } from 'react';
import { Container } from '@/components/design-system/Container';

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  highlight?: string;
  subtitle?: ReactNode;
  align?: 'center' | 'left';
  children?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  highlight,
  subtitle,
  align = 'center',
  children,
}: PageHeaderProps) {
  const alignClass = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <section className="border-outline-variant/15 bg-background relative isolate overflow-hidden border-b pt-28 pb-20 lg:pt-32 lg:pb-24">
      <Container className={`relative z-10 flex flex-col ${alignClass}`}>
        {eyebrow ? (
          <span className="border-outline-variant/30 bg-surface-container/40 text-primary mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-[0.18em] uppercase backdrop-blur-md">
            <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
            {eyebrow}
          </span>
        ) : null}
        <h1 className="text-on-surface max-w-4xl text-4xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
          {title}
          {highlight ? (
            <>
              {' '}
              <span className="text-primary">{highlight}</span>
            </>
          ) : null}
        </h1>
        {subtitle ? (
          <p className="text-on-surface-variant mt-6 max-w-2xl text-lg leading-relaxed md:text-xl">
            {subtitle}
          </p>
        ) : null}
        {children ? <div className="mt-10">{children}</div> : null}
      </Container>
    </section>
  );
}
