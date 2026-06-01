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

/** Route-level skeleton for the admin overview dashboard. */
export function AdminOverviewRouteSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading admin overview">
      <AdminRouteHeaderSkeleton />
      <AdminOverviewSkeleton />
    </div>
  );
}

/** Header skeleton for the admin user detail page. */
export function AdminUserHeaderSkeleton() {
  return (
    <>
      <Skeleton className="h-5 w-32" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-52 max-w-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-9 rounded-lg" />
      </header>
    </>
  );
}

/** Stats and chart skeleton for the admin user detail page. */
export function AdminUserActivitySkeleton() {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Loading user stats">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] px-4 py-3"
          >
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </section>
      <div
        className="rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-5"
        aria-label="Loading activity chart"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <ActivityChartSkeleton />
      </div>
    </>
  );
}

function ActivityChartSkeleton() {
  return <Skeleton className="h-44 rounded-md opacity-70" />;
}

/** Role card skeleton for the admin user detail page. */
export function AdminUserRoleSkeleton() {
  return (
    <div
      className="rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-5"
      aria-label="Loading user role"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-9 w-full rounded-md sm:w-[220px]" />
      </div>
    </div>
  );
}

/** Permission exceptions skeleton for the admin user detail page. */
export function AdminUserPermissionsSkeleton() {
  return (
    <div
      className="rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-5"
      aria-label="Loading permission exceptions"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full max-w-2xl" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      </div>
      <div className="divide-y divide-[color:var(--color-border-subtle)]">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-9 w-56 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for the admin user detail route. */
export function AdminUserDetailSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading user detail">
      <AdminUserHeaderSkeleton />
      <AdminUserActivitySkeleton />
      <AdminUserRoleSkeleton />
      <AdminUserPermissionsSkeleton />
      <Skeleton className="h-3 w-44" />
    </div>
  );
}

/** Skeleton for the admin roles permission matrix route. */
export function AdminRolesSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8" aria-label="Loading roles">
      <div className="-mx-6 -mt-6 mb-6 border-b border-[color:var(--color-border-subtle)] px-6 py-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>

      <div className="flex items-center gap-2">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>

      <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] lg:max-h-[calc(100dvh-14rem)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border-subtle)] px-5 py-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-44" />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="min-w-[760px]">
            <div
              className="grid items-center border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] px-5 py-4"
              style={{
                gridTemplateColumns: 'minmax(220px, 1.05fr) repeat(3, minmax(124px, 0.8fr))',
              }}
            >
              <Skeleton className="h-3 w-24" />
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex justify-center">
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>

            {Array.from({ length: 3 }).map((_, groupIndex) => (
              <section
                key={groupIndex}
                className="border-b border-[color:var(--color-border-subtle)] px-4 py-3 last:border-b-0"
              >
                <Skeleton className="mb-2 h-3 w-32" />
                <div className="space-y-2">
                  {Array.from({ length: groupIndex === 0 ? 4 : 3 }).map((__, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="grid items-center rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-4 py-3"
                      style={{
                        gridTemplateColumns:
                          'minmax(220px, 1.05fr) repeat(3, minmax(124px, 0.8fr))',
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-4 rounded-full" />
                      </div>
                      {Array.from({ length: 3 }).map((___, columnIndex) => (
                        <div key={columnIndex} className="flex justify-center">
                          <Skeleton className="h-8 w-24 rounded-md" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Generic admin list route skeleton with page header, filters, and table. */
export function AdminTableRouteSkeleton({
  rows = 10,
  columns = 6,
  filterCount = 2,
  hasAction = false,
  ariaLabel = 'Loading admin table',
}: {
  rows?: number;
  columns?: number;
  filterCount?: number;
  hasAction?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8" aria-label={ariaLabel}>
      <AdminRouteHeaderSkeleton hasAction={hasAction} />
      <AdminFilterControlsSkeleton filterCount={filterCount} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <TableSkeleton rows={rows} columns={columns} />
      </div>
    </div>
  );
}

/** Skeleton for the admin imports list route. */
export function AdminImportsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading imports">
      <AdminRouteHeaderSkeleton />
      <div className="rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_140px]">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-5"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-10 w-64 rounded-xl" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_120px_auto_auto]">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 w-20 rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for the admin import review route. */
export function AdminImportDetailSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading import detail">
      <AdminRouteHeaderSkeleton />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <Skeleton className="h-7 w-56" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-11 w-full rounded-xl sm:w-[260px]" />
            <Skeleton className="h-11 w-40 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-[min(56vh,520px)] min-h-80 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <AdminFormCardSkeleton rows={3} />
        <AdminFormCardSkeleton rows={5} />
      </div>
      <AdminFormCardSkeleton rows={5} />
    </div>
  );
}

/** Skeleton for admin effect editor detail pages. */
export function AdminEffectEditorSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading effect editor">
      <AdminRouteHeaderSkeleton />
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Skeleton className="h-[520px] rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[720px] rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for product-level firework editor detail pages. */
export function AdminFireworkEditorSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8" aria-label="Loading firework editor">
      <AdminRouteHeaderSkeleton />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

function AdminRouteHeaderSkeleton({ hasAction = false }: { hasAction?: boolean }) {
  return (
    <div className="-mx-6 -mt-6 mb-6 border-b border-[color:var(--color-border-subtle)] px-6 py-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        {hasAction ? <Skeleton className="h-11 w-36 rounded-full" /> : null}
      </div>
    </div>
  );
}

function AdminFilterControlsSkeleton({ filterCount }: { filterCount: number }) {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-11 flex-1 rounded-xl" />
      {Array.from({ length: filterCount }).map((_, index) => (
        <Skeleton key={index} className="hidden h-11 w-32 rounded-full sm:block" />
      ))}
      <Skeleton className="h-11 w-28 rounded-full" />
    </div>
  );
}

function AdminFormCardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-5">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-11 rounded-xl" />
        ))}
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
