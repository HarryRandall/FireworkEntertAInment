/**
 * Route-level skeleton placeholders used by Next.js `loading.tsx`
 * files inside the `/app` and `/admin` route groups. Each export
 * mirrors the layout of a specific page so the swap to real content
 * does not cause large layout shifts.
 */
import { Gauge, ListFilter, Search } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/Feedback';
import { Button } from '@/app/components/ui/Button';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { Input } from '@/app/components/ui/Input';
import { StatTile } from '@/app/components/ui/StatTile';

const ADMIN_OVERVIEW_STAT_LABELS = [
  'Users',
  'Suppliers',
  'Imports',
  'Catalogue products',
  'Fireworks',
  'Effects',
] as const;

const ADMIN_OVERVIEW_ACTIVITY_GROUPS = [
  {
    title: 'Platform mix',
    rows: ['Users', 'Suppliers', 'Catalogue', 'Fireworks', 'Effects'],
  },
  {
    title: 'Import pipeline',
    rows: ['Draft', 'Needs review', 'Complete'],
  },
] as const;

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

/** Minimal table fallback matching DataTable header + row rhythm. */
export function TableSkeleton({
  rows = 8,
  columns = 5,
  headers,
  tableClassName,
  rowSize = 'default',
}: {
  rows?: number;
  columns?: number;
  headers?: string[];
  tableClassName?: string;
  rowSize?: AdminTableSkeletonRowSize;
}) {
  const tableHeaders = headers ?? Array.from({ length: columns }, () => '');
  return (
    <AdminTableRowsSkeleton
      headers={tableHeaders}
      rows={rows}
      tableClassName={tableClassName}
      rowSize={rowSize}
    />
  );
}

/** Filter bar placeholder for list routes. */
export function FilterSkeleton({
  searchPlaceholder = 'Search...',
}: {
  searchPlaceholder?: string;
}) {
  return <AdminFilterControlsSkeleton searchPlaceholder={searchPlaceholder} />;
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
      <AdminAnalyserWarmupSkeleton />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {ADMIN_OVERVIEW_STAT_LABELS.map((label) => (
          <StatTile
            key={label}
            label={label}
            labelAddon={
              label === 'Users' ? (
                <InfoTooltip text="This is the total users we have." />
              ) : undefined
            }
            value={<Skeleton className="h-7 w-12" />}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ADMIN_OVERVIEW_ACTIVITY_GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-5"
          >
            <h2 className="text-lg font-bold text-[color:var(--color-content-emphasis)]">
              {group.title}
            </h2>
            <div className="mt-4 space-y-3">
              {group.rows.map((row) => (
                <div key={row} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-[color:var(--color-content-subtle)]">
                      {row}
                    </span>
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Route-level skeleton for the admin overview dashboard. */
export function AdminOverviewRouteSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading admin overview">
      <AdminRouteHeaderSkeleton
        title="Platform command centre"
        description="Manage access, suppliers, catalogue data, and VDL/video import records from a dedicated control surface."
      />
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
      <AdminRouteHeaderSkeleton
        title="Roles"
        description="Edit the default permissions each role receives."
      />

      <AdminFilterControlsSkeleton searchPlaceholder="Search permissions by name or area..." />

      <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] lg:max-h-[calc(100dvh-14rem)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border-subtle)] px-5 py-4">
          <h2 className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
            Role defaults
          </h2>
          <span className="text-xs text-[color:var(--color-content-subtle)]">
            Changes save automatically.
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="min-w-[760px]">
            <div
              className="grid items-center border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] px-5 py-4"
              style={{
                gridTemplateColumns: 'minmax(220px, 1.05fr) repeat(3, minmax(124px, 0.8fr))',
              }}
            >
              <div className="text-xs font-medium tracking-wide text-[color:var(--color-content-subtle)] uppercase">
                Permission
              </div>
              {['Admin', 'Supplier', 'User'].map((role) => (
                <div
                  key={role}
                  className="text-center text-xs font-semibold tracking-wide text-[color:var(--color-content-emphasis)] uppercase"
                >
                  {role}
                </div>
              ))}
            </div>

            <div className="space-y-2 px-4 py-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-4 py-5"
                >
                  <Skeleton className="h-4 w-full max-w-[220px]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Generic admin list route skeleton with page header, filters, and table. */
export function AdminTableRouteSkeleton({
  rows = 8,
  headers,
  title,
  description,
  searchPlaceholder = 'Search...',
  tableClassName,
  rowSize = 'default',
  hasAction = false,
  ariaLabel = 'Loading admin table',
}: {
  rows?: number;
  headers: string[];
  title: string;
  description: string;
  searchPlaceholder?: string;
  tableClassName?: string;
  rowSize?: AdminTableSkeletonRowSize;
  hasAction?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8" aria-label={ariaLabel}>
      <AdminRouteHeaderSkeleton title={title} description={description} hasAction={hasAction} />
      <AdminFilterControlsSkeleton searchPlaceholder={searchPlaceholder} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <AdminTableRowsSkeleton
          headers={headers}
          rows={rows}
          tableClassName={tableClassName}
          rowSize={rowSize}
        />
      </div>
    </div>
  );
}

/** Skeleton for the admin imports list route. */
export function AdminImportsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading imports">
      <AdminRouteHeaderSkeleton
        title="Firework video reconstruction"
        description="Upload short source videos, generate a synced 3D reconstruction, then review and publish the result to the catalogue."
      />
      <div className="rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-5">
        <h2 className="text-lg font-bold text-[color:var(--color-content-emphasis)]">
          Upload firework video
        </h2>
        <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
          Import a video up to 1 minute, then let the worker reconstruct a reviewable 3D firework.
        </p>
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

function AdminRouteHeaderSkeleton({
  title,
  description,
  hasAction = false,
}: {
  title?: string;
  description?: string;
  hasAction?: boolean;
}) {
  return (
    <div className="-mx-6 -mt-6 mb-6 border-b border-[color:var(--color-border-subtle)] px-6 py-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {title ? (
            <h1 className="text-lg leading-7 font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
              {title}
            </h1>
          ) : (
            <Skeleton className="h-6 w-40" />
          )}
          {description ? (
            <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">{description}</p>
          ) : (
            <Skeleton className="mt-2 h-4 w-96 max-w-full" />
          )}
        </div>
        {hasAction ? <Skeleton className="h-11 w-36 rounded-full" /> : null}
      </div>
    </div>
  );
}

function AdminFilterControlsSkeleton({ searchPlaceholder }: { searchPlaceholder: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            readOnly
            tabIndex={-1}
            value=""
            placeholder={searchPlaceholder}
            iconLeft={<Search size={16} />}
            aria-label="Search"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          tabIndex={-1}
          aria-disabled
          className="pointer-events-none"
        >
          <ListFilter size={16} />
          Filter
        </Button>
      </div>
    </div>
  );
}

function AdminAnalyserWarmupSkeleton() {
  return (
    <div className="rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-subtle)]">
            <Gauge aria-hidden className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
                Analyser warm-up
              </h2>
              <InfoTooltip text="Keeps the analyser container ready for demos or rapid testing. It turns off automatically after 30 minutes." />
            </div>
            <p className="mt-0.5 text-xs text-[color:var(--color-content-subtle)]">
              Idle: next analysis may cold start.
            </p>
          </div>
        </div>
        <div className="flex h-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-content-emphasis)] px-5 text-sm font-semibold text-[color:var(--color-bg-default)]">
          Keep warm 30 min
        </div>
      </div>
    </div>
  );
}

type AdminTableSkeletonRowSize = 'default' | 'relaxed';

function AdminTableRowsSkeleton({
  headers,
  rows,
  tableClassName,
  rowSize,
}: {
  headers: string[];
  rows: number;
  tableClassName?: string;
  rowSize: AdminTableSkeletonRowSize;
}) {
  return (
    <DataTableShell
      viewport
      footer={<AdminTablePaginationSkeleton />}
      className="h-full max-h-full bg-[color:var(--color-bg-default)]"
    >
      <table className={tableClasses(tableClassName)} aria-label="Loading table">
        <thead className={tableHeadClasses()}>
          <tr>
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className={tableHeaderCellClasses(
                  header === 'Open' || header === 'Actions' ? 'px-5 py-3 text-right' : 'px-5 py-3',
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className={tableRowClasses()}>
              {headers.map((header, columnIndex) => (
                <td
                  key={`${rowIndex}-${header}-${columnIndex}`}
                  className={tableCellClasses(getTableSkeletonCellWrapperClass(header, rowSize))}
                >
                  <Skeleton className={getTableSkeletonCellClass(header, columnIndex)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}

function getTableSkeletonCellWrapperClass(header: string, rowSize: AdminTableSkeletonRowSize) {
  const padding = rowSize === 'relaxed' ? 'px-5 py-6' : 'px-5 py-4';
  return header === 'Open' || header === 'Actions' ? `${padding} text-right` : padding;
}

function AdminTablePaginationSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center gap-1">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-16 rounded-full" />
      </div>
    </div>
  );
}

function getTableSkeletonCellClass(header: string, columnIndex: number) {
  const normalized = header.toLowerCase();

  if (normalized === 'preview') return 'h-9 w-9 rounded-lg';
  if (normalized === 'open' || normalized === 'actions') return 'ml-auto h-4 w-8';
  if (
    normalized === 'status' ||
    normalized === 'role' ||
    normalized === 'type' ||
    normalized === 'duration' ||
    normalized === 'shots' ||
    normalized === 'calibre' ||
    normalized === 'updated'
  ) {
    return 'h-4 w-16 max-w-full rounded-md';
  }
  if (normalized === 'effects') return 'h-4 w-28 max-w-full rounded-md';
  if (columnIndex === 0) return 'h-4 w-28 max-w-full';
  return 'h-4 w-36 max-w-full';
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
