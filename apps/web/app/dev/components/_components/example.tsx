/** Gallery documentation surfaces keep examples grouped like the prototype. */
import type { ReactNode } from 'react';

/** Describes one component family and its interactive state examples. */
export function Example({
  id,
  title,
  source,
  description,
  children,
}: {
  id: string;
  title: string;
  source: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article
      id={id}
      className="border-border bg-card scroll-mt-6 overflow-hidden rounded-xl border"
    >
      <header className="border-border grid gap-2 border-b p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <span className="text-muted-foreground font-mono text-xs">{source}</span>
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>
      <div className="grid gap-5 p-5">{children}</div>
    </article>
  );
}
/** Labels an individual component state for visual review. */
export function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-3">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
/** Groups a family of shared components under a navigation anchor. */
export function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
