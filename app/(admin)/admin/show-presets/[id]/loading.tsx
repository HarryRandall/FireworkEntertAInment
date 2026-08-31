/** Loading skeleton for the admin curated show editor. */

import { Skeleton } from '@/components/design-system/Feedback';

export default function AdminShowPresetEditorLoading() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-5"
      aria-label="Loading curated show editor"
    >
      <div className="grid shrink-0 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="bg-stage-night relative h-[520px] overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)]">
          <div className="absolute inset-x-8 bottom-8 space-y-3">
            <Skeleton className="h-4 w-40 bg-white/15" />
            <Skeleton className="h-12 rounded-xl bg-white/15" />
          </div>
        </section>
        <aside className="flex max-h-[520px] min-h-0 flex-col overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)]">
          <div className="min-h-0 flex-1 space-y-4 px-4 pt-4 pb-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-16 rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-14 rounded-md" />
              <Skeleton className="h-14 rounded-md" />
            </div>
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-[color:var(--color-border-subtle)] p-3">
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
      <section className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-3 w-80 max-w-full" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </section>
    </div>
  );
}
