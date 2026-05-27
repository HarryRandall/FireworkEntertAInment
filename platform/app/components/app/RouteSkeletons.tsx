/**
 * Route-level skeleton placeholders used by Next.js `loading.tsx`
 * files inside the `/app` and `/admin` route groups. Each export
 * mirrors the layout of a specific page so the swap to real content
 * does not cause large layout shifts.
 */
import { Skeleton } from '@/app/components/ui/Feedback';

/** Grid of card placeholders for paginated list routes. */
export function CardGridSkeleton({
  count = 6,
  className = 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-label="Loading cards">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-64 rounded-xl" />
      ))}
    </div>
  );
}

/** Table-shaped skeleton matching DataTable header + rows. */
export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-[color:var(--color-border-subtle)]"
      aria-label="Loading table"
    >
      <div className="grid gap-px bg-[color:var(--color-border-subtle)]">
        {Array.from({ length: rows + 1 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-4 bg-[color:var(--color-bg-default)] p-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <Skeleton key={columnIndex} className={rowIndex === 0 ? 'h-4' : 'h-6'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Filter bar placeholder for list routes. */
export function FilterSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border-subtle)] p-4 sm:flex-row">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-full sm:w-44" />
      <Skeleton className="h-10 w-full sm:w-44" />
    </div>
  );
}

/** Skeleton for the `/library` template grid. */
export function LibraryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3" aria-label="Loading library templates">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="border-outline-variant/45 bg-surface-container-low/80 overflow-hidden rounded-xl border"
        >
          <Skeleton className="h-52 rounded-none" />
          <div className="space-y-4 p-5">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the `/admin` overview dashboard. */
export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading admin overview">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

/** Skeleton for the replay panel on the show detail route. */
export function ReplayPanelSkeleton() {
  return (
    <div
      className="border-outline-variant/35 bg-surface-container-low h-[min(72vh,680px)] min-h-[520px] rounded-xl border"
      aria-label="Loading replay"
    >
      <Skeleton className="h-full rounded-xl" />
    </div>
  );
}

/** Generic vertical list skeleton with `rows` placeholder rows. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 rounded-lg" />
      ))}
    </div>
  );
}
