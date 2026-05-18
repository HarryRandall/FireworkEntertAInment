import { Skeleton } from "@/app/components/ui/Feedback";

export function CardGridSkeleton({
  count = 6,
  className = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
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

export function TableSkeleton({
  rows = 8,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
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
              <Skeleton
                key={columnIndex}
                className={rowIndex === 0 ? "h-4" : "h-6"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FilterSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border-subtle)] p-4 sm:flex-row">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-full sm:w-44" />
      <Skeleton className="h-10 w-full sm:w-44" />
    </div>
  );
}

export function LibraryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3" aria-label="Loading library templates">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-outline-variant/45 bg-surface-container-low/80"
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

export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading admin overview">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
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

export function ReplayPanelSkeleton() {
  return (
    <div
      className="h-[min(72vh,680px)] min-h-[520px] rounded-xl border border-outline-variant/35 bg-surface-container-low"
      aria-label="Loading replay"
    >
      <Skeleton className="h-full rounded-xl" />
    </div>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 rounded-lg" />
      ))}
    </div>
  );
}
