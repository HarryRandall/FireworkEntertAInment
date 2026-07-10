/** Loading skeleton for the admin curated show editor. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminShowPresetEditorLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5" aria-label="Loading curated show editor">
      <div className="grid shrink-0 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="bg-stage-night relative h-[520px] overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)]">
          <div className="absolute inset-x-8 bottom-8 space-y-3">
            <Skeleton className="h-4 w-40 bg-white/15" />
            <Skeleton className="h-12 rounded-xl bg-white/15" />
          </div>
        </section>
        <aside className="flex max-h-[520px] min-h-0 flex-col gap-3 overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <div className="mt-auto grid grid-cols-2 gap-2">
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
          </div>
        </aside>
      </div>
      <section className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
        <Skeleton className="h-5 w-24" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-7 rounded-md" />
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
        <Skeleton className="h-5 w-64" />
      </section>
    </div>
  );
}
