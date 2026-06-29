/** Loading skeleton for the admin multishot editor. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminMultishotDetailLoading() {
  return (
    <div
      className="grid min-h-0 gap-8 xl:grid-cols-[minmax(0,380px)_1fr]"
      aria-label="Loading multishot"
    >
      <section className="space-y-5 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </section>

      <section className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)]">
          <div className="grid grid-cols-[1fr_7rem_7rem_6rem] gap-4 border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] px-4 py-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, row) => (
            <div
              key={row}
              className="grid grid-cols-[1fr_7rem_7rem_6rem] gap-4 border-b border-[color:var(--color-border-subtle)] px-4 py-4 last:border-b-0"
            >
              {Array.from({ length: 4 }).map((_, column) => (
                <Skeleton key={column} className="h-9 w-full rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
