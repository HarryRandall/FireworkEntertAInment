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
    <article id={id} className="grid min-w-0 scroll-mt-5 gap-2.5">
      <header className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-muted-foreground font-mono text-[11.5px]">{source}</span>
        <p className="text-muted-foreground basis-full text-sm">{description}</p>
      </header>
      <div className="border-border bg-card grid min-w-0 grid-cols-1 gap-4 rounded-lg border p-6">
        {children}
      </div>
    </article>
  );
}
/** Labels an individual component state for visual review. */
export function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
/** Groups a family of shared components under a navigation anchor. */
export function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="grid min-w-0 scroll-mt-6 grid-cols-1 gap-[18px]">
      <h2 className="border-border border-b pb-2 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
