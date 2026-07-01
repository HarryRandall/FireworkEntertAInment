/**
 * Route-level skeleton placeholders used by Next.js `loading.tsx`
 * files inside the `/app` and `/admin` route groups. Each export
 * mirrors the layout of a specific page so the swap to real content
 * does not cause large layout shifts.
 */
import { Fragment, type ComponentType } from 'react';
import {
  CircleDot,
  Cloud,
  History,
  ListFilter,
  Maximize2,
  Play,
  Plus,
  Repeat,
  Rocket,
  RotateCcw,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Volume2,
  Wind,
  Zap,
} from 'lucide-react';
import { ReplayPanelLoadingStage } from '@/app/components/app/ReplayPanelLoadingStage';
import { Button } from '@/app/components/ui/Button';
import { Skeleton } from '@/app/components/ui/Feedback';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { Input } from '@/app/components/ui/Input';
import { cn } from '@/lib/utils';

const EXPLORE_SKELETON_SHELVES = [
  'Staff picks',
  'Popular this month',
  'Hot right now',
  'Fresh drops',
  'Quick bursts',
];

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
  actionLabel,
}: {
  searchPlaceholder?: string;
  actionLabel?: string;
}) {
  return (
    <AdminFilterControlsSkeleton searchPlaceholder={searchPlaceholder} actionLabel={actionLabel} />
  );
}

/** Skeleton for the `/library` template grid. */
export function LibraryCardsSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading library templates">
      {EXPLORE_SKELETON_SHELVES.map((title) => (
        <section key={title}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-on-surface text-lg font-semibold tracking-tight">{title}</h2>
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>

          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="w-44 shrink-0 sm:w-48">
                <Skeleton className="aspect-[4/5] w-full rounded-xl" />
                <div className="mt-2.5 flex items-center gap-2">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-10 rounded-md" />
                </div>
                <Skeleton className="mt-2 h-3 w-24" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Skeleton for the `/admin` overview dashboard. */
export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading admin overview">
      <AdminOverviewControlsSkeleton />
      <AdminOverviewContentSkeleton />
    </div>
  );
}

type AdminOverviewSkeletonTab = 'catalogue' | 'generation' | 'imports' | 'overview';

/** Content-only skeleton for async `/admin` overview tab panels. */
export function AdminOverviewContentSkeleton({
  tab = 'overview',
}: {
  tab?: AdminOverviewSkeletonTab;
}) {
  if (tab === 'catalogue') return <AdminOverviewCatalogueContentSkeleton />;
  if (tab === 'imports') return <AdminOverviewImportsContentSkeleton />;
  if (tab === 'generation') return <AdminOverviewGenerationContentSkeleton />;
  return <AdminOverviewDashboardContentSkeleton />;
}

function AdminOverviewControlsSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="bg-muted inline-flex h-9 max-w-full items-center gap-1 overflow-hidden rounded-lg p-[3px]">
        {['w-18', 'w-20', 'w-16', 'w-24'].map((widthClass, index) => (
          <Skeleton key={index} className={cn('h-7 rounded-md', widthClass)} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
    </div>
  );
}

function AdminOverviewDashboardContentSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading admin overview content">
      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl shadow-xs ring-1">
        <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-4 p-6">
              <Skeleton className="h-4 w-28" />
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <AdminOverviewPanelSkeleton className="xl:col-span-7" chartClassName="h-72" />
        <AdminOverviewPanelSkeleton className="xl:col-span-5" chartClassName="h-36" compact />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <AdminOverviewPanelSkeleton className="xl:col-span-7" chartClassName="h-64" table />
        <AdminOverviewPanelSkeleton
          className="xl:col-span-5 xl:col-start-8"
          chartClassName="h-64"
        />
      </div>
    </div>
  );
}

function AdminOverviewCatalogueContentSkeleton() {
  return (
    <div className="flex-1 text-sm outline-none" aria-label="Loading catalogue overview">
      <div className="bg-card ring-foreground/10 rounded-xl py-6 shadow-xs ring-1">
        <div className="mb-5 px-6">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="grid gap-6 px-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, sectionIndex) => (
            <div key={sectionIndex} className="min-w-0 space-y-3">
              <Skeleton className="h-4 w-20" />
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <div key={rowIndex} className="space-y-1.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <Skeleton className="h-4 w-36 max-w-full" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminOverviewImportsContentSkeleton() {
  return (
    <div className="flex-1 text-sm outline-none" aria-label="Loading import pipeline">
      <div className="bg-card ring-foreground/10 rounded-xl py-6 shadow-xs ring-1">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="px-6">
          <div className="grid grid-cols-[minmax(0,1fr)_6rem_6rem] gap-4 border-b pb-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="ml-auto h-4 w-10" />
            <Skeleton className="ml-auto h-4 w-12" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_6rem_6rem] gap-4 border-b py-4 last:border-b-0"
            >
              <Skeleton className="h-4 w-28 max-w-full" />
              <Skeleton className="ml-auto h-4 w-8" />
              <Skeleton className="ml-auto h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminOverviewGenerationContentSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col gap-4 text-sm outline-none"
      aria-label="Loading generation overview"
    >
      <div className="bg-card ring-foreground/10 rounded-xl p-5 shadow-xs ring-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <AdminOverviewPanelSkeleton className="xl:col-span-7" chartClassName="h-72" />
        <AdminOverviewPanelSkeleton className="xl:col-span-5" chartClassName="h-36" compact />
      </div>
    </div>
  );
}

/** Route-level skeleton for the admin overview dashboard. */
export function AdminOverviewRouteSkeleton() {
  return <AdminOverviewSkeleton />;
}

function AdminOverviewPanelSkeleton({
  chartClassName,
  className,
  compact = false,
  table = false,
}: {
  chartClassName: string;
  className?: string;
  compact?: boolean;
  table?: boolean;
}) {
  return (
    <div className={cn('bg-card ring-foreground/10 rounded-xl py-6 shadow-xs ring-1', className)}>
      <div className="mb-5 px-6">
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="px-6">
        {table ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-48 max-w-[55%]" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Skeleton className={cn('w-full rounded-md opacity-70', chartClassName)} />
        )}
        {compact ? (
          <div className="mt-4 grid grid-cols-2 gap-0">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="m-2 h-5" />
            ))}
          </div>
        ) : null}
      </div>
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
          <div key={index} className="border-border bg-card rounded-lg border px-4 py-3">
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </section>
      <div
        className="border-border bg-card rounded-xl border p-5"
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
    <div className="border-border bg-card rounded-xl border p-5" aria-label="Loading user role">
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
      className="border-border bg-card rounded-xl border p-5"
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
      <div className="divide-border divide-y">
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
      <AdminFilterControlsSkeleton searchPlaceholder="Search permissions by name or area..." />

      <DataTableShell
        viewport
        className="bg-card min-h-[420px] flex-1 lg:max-h-[calc(100dvh-14rem)]"
        footer={
          <div>
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        }
      >
        <table className={tableClasses()} aria-label="Loading role defaults">
          <thead className={tableHeadClasses()}>
            <tr>
              {['Permission', 'Admin', 'Supplier', 'User'].map((header) => (
                <th
                  key={header}
                  className={tableHeaderCellClasses(
                    header === 'Permission' ? undefined : 'text-center',
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['Platform access', 'Show builder'].map((group) => (
              <Fragment key={group}>
                <tr key={`${group}-group`} className={tableRowClasses('bg-muted/45')}>
                  <th
                    colSpan={4}
                    className={tableCellClasses(
                      'text-muted-foreground py-2 text-left font-medium whitespace-normal',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {group}
                      <Skeleton className="h-5 w-7 rounded-sm" />
                    </span>
                  </th>
                </tr>
                {Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`${group}-${index}`} className={tableRowClasses()}>
                    <td className={tableCellClasses('whitespace-normal')}>
                      <Skeleton className="h-4 w-full max-w-[220px]" />
                      <Skeleton className="mt-2 h-3 w-full max-w-[300px]" />
                    </td>
                    {[0, 1, 2].map((roleIndex) => (
                      <td key={roleIndex} className={tableCellClasses('text-center')}>
                        <Skeleton className="mx-auto h-8 w-24 rounded-md" />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}

/** Skeleton for the admin prompt control route. */
export function AdminPromptsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="Loading prompts">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Prompt settings"
          className="border-border bg-card inline-flex flex-wrap gap-1 rounded-lg border p-1"
        >
          {[0, 1, 2].map((item) => (
            <Skeleton
              key={item}
              className={item === 1 ? 'h-9 w-36 rounded-md' : 'h-9 w-28 rounded-md'}
            />
          ))}
        </nav>

        <div className="border-border bg-card inline-flex items-center gap-1 rounded-lg border p-1">
          {[0, 1].map((item) => (
            <Skeleton key={item} className="h-9 w-24 rounded-md" />
          ))}
        </div>
      </div>

      <div className="border-border bg-card rounded-lg border p-4 pb-5 shadow-xs">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
              <div className="min-w-0">
                <h2 className="text-foreground text-lg font-semibold">
                  Show generation system prompt
                </h2>
                <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
                  Define the system instructions used when the LLM turns a song and creative brief
                  into show cues.
                </p>
              </div>
            </div>
            <Skeleton className="mt-0.5 h-6 w-16 shrink-0 rounded-md" />
          </div>

          <Skeleton className="min-h-[24rem] rounded-md" />

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Skeleton className="h-10 w-full rounded-lg sm:w-[92px]" />
            <Skeleton className="h-10 w-full rounded-lg sm:w-[82px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Generic admin list route skeleton with filters and table. */
export function AdminTableRouteSkeleton({
  rows = 8,
  headers,
  searchPlaceholder = 'Search...',
  tableClassName,
  rowSize = 'default',
  hasAction = false,
  filterActionLabel,
  ariaLabel = 'Loading admin table',
}: {
  rows?: number;
  headers: string[];
  searchPlaceholder?: string;
  tableClassName?: string;
  rowSize?: AdminTableSkeletonRowSize;
  hasAction?: boolean;
  filterActionLabel?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8" aria-label={ariaLabel}>
      {hasAction ? (
        <div className="flex justify-end">
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      ) : null}
      <AdminFilterControlsSkeleton
        searchPlaceholder={searchPlaceholder}
        actionLabel={filterActionLabel}
      />
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
      <div className="border-border bg-card rounded-lg border p-5">
        <h2 className="text-foreground text-lg font-bold">Upload firework video</h2>
        <p className="text-muted-foreground mt-1 text-sm">
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
          <div key={index} className="border-border bg-card rounded-lg border p-5">
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
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="border-border bg-card rounded-lg border p-5">
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
  return <AdminVisualEditorSkeleton label="Loading effect editor" />;
}

/** Skeleton for product-level firework editor detail pages. */
export function AdminFireworkEditorSkeleton() {
  return <AdminVisualEditorSkeleton label="Loading firework editor" />;
}

/** Skeleton for style-default editor pages, which expose a narrow section rail. */
export function AdminStyleDefaultEditorSkeleton() {
  return (
    <AdminVisualEditorSkeleton
      label="Loading style default editor"
      primaryTabs={[
        { label: 'Details', icon: SlidersHorizontal },
        { label: 'Trail', icon: Wind },
      ]}
      utilityTabs={[{ label: 'JSON', icon: BracesSkeletonIcon }]}
    />
  );
}

function AdminVisualEditorSkeleton({
  label,
  primaryTabs = [
    { label: 'Details', icon: SlidersHorizontal },
    { label: 'Star', icon: Sparkles },
    { label: 'Star Inner', icon: CircleDot },
    { label: 'Trail', icon: Wind },
    { label: 'Launch', icon: Rocket },
    { label: 'FX', icon: Zap },
    { label: 'Smoke', icon: Cloud },
    { label: 'Sound', icon: Volume2 },
  ],
  utilityTabs = [
    { label: 'History', icon: History },
    { label: 'JSON', icon: BracesSkeletonIcon },
  ],
}: {
  label: string;
  primaryTabs?: EditorSkeletonTab[];
  utilityTabs?: EditorSkeletonTab[];
}) {
  return (
    <div
      className="grid h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-none bg-[color:var(--color-bg-default)] lg:grid-cols-[minmax(0,1fr)_60px]"
      aria-label={label}
    >
      <section className="relative min-h-[520px] overflow-hidden bg-[#05070d] text-white lg:min-h-0">
        <div
          className="h-full bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,255,255,0.035),transparent_44%),linear-gradient(180deg,#05070d_0%,#070b14_58%,#020307_100%)]"
          aria-hidden
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-3 px-4 pt-6 pb-4 sm:px-5 sm:pb-5">
          <div className="flex flex-wrap items-start justify-end gap-3 pr-16 sm:pr-[4.5rem]">
            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                tabIndex={-1}
                aria-disabled
                className="pointer-events-none h-9 rounded-[10px] border-white/15 bg-white/8 px-3 text-xs text-white backdrop-blur-md hover:bg-white/14 hover:text-white"
              >
                <Undo2 size={14} />
                Revert
              </Button>
              <Button
                type="button"
                tabIndex={-1}
                aria-disabled
                className="pointer-events-none h-9 rounded-[10px] bg-[color:var(--hl)] px-4 text-xs font-semibold text-[#05231a] hover:bg-[color:var(--hl)]/85"
              >
                <Save size={14} />
                Save
              </Button>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute top-6 right-6 z-30">
          <div className="focus-glow-action border-outline-variant/15 bg-surface-container-low/80 text-on-surface flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-150 ease-out">
            <Settings size={16} strokeWidth={2} aria-hidden />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
          <EditorTransportSkeleton />
        </div>
      </section>

      <aside className="grid min-h-0 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] lg:grid-cols-[60px] lg:border-t-0 lg:border-l">
        <div className="order-1 flex min-w-0 gap-1 overflow-x-auto bg-[color:var(--color-bg-muted)] p-2 lg:order-2 lg:flex-col lg:items-center lg:gap-1 lg:overflow-x-visible lg:overflow-y-auto lg:px-0 lg:py-2.5">
          <nav
            className="flex min-w-0 gap-1 lg:min-h-0 lg:w-full lg:flex-1 lg:flex-col lg:items-center"
            aria-label="Editor sections"
          >
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <div
                  key={tab.label}
                  className="relative flex h-[46px] min-w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] border border-transparent px-2 text-center text-[color:var(--color-content-subtle)] lg:h-[52px] lg:w-12 lg:min-w-12 lg:px-1"
                >
                  <Icon size={18} />
                  <span className="max-h-[1.25rem] max-w-full overflow-hidden text-[9px] leading-[1.05] font-semibold tracking-normal">
                    {tab.label}
                  </span>
                </div>
              );
            })}
            <div className="hidden flex-1 lg:block" aria-hidden />
            <div
              className="hidden h-px w-full shrink-0 bg-[color:var(--color-border-subtle)] lg:block"
              aria-hidden
            />
            {utilityTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <div
                  key={tab.label}
                  className="relative flex h-[46px] min-w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] border border-transparent px-2 text-center text-[color:var(--color-content-subtle)] lg:h-[52px] lg:w-12 lg:min-w-12 lg:px-1"
                >
                  <Icon size={18} />
                  <span className="max-h-[1.25rem] max-w-full overflow-hidden text-[9px] leading-[1.05] font-semibold tracking-normal">
                    {tab.label}
                  </span>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </div>
  );
}

type EditorSkeletonTab = {
  label: string;
  icon: ComponentType<{ size?: number }>;
};

function BracesSkeletonIcon({ size = 18 }: { size?: number }) {
  return (
    <span
      className="font-mono text-[18px] leading-none text-current"
      style={{ fontSize: size }}
      aria-hidden
    >
      {'{}'}
    </span>
  );
}

function EditorTransportSkeleton() {
  return (
    <div
      className="pointer-events-auto mx-auto flex w-[calc(100%_-_2rem)] max-w-[620px] items-center gap-2 rounded-xl border border-white/12 bg-black/55 px-4 py-3 text-white shadow-[var(--shadow-modal)] backdrop-blur-md"
      aria-label="Loading preview controls"
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-black shadow-[var(--shadow-cta)]">
        <Play size={17} className="translate-x-0.5" fill="currentColor" strokeWidth={2.5} />
      </div>
      <div className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white">
        <RotateCcw size={15} strokeWidth={2} />
      </div>
      <div className="grid size-10 shrink-0 place-items-center rounded-full border border-transparent bg-[color:var(--hl,#10b981)] text-black">
        <Repeat size={15} strokeWidth={2} />
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <span className="min-w-[2.55rem] text-right font-mono text-[11px] text-white/75 tabular-nums">
          0:00
        </span>
        <div className="relative flex h-7 min-w-0 items-center rounded-full">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/90" />
          {[28, 54, 82].map((left) => (
            <span
              key={left}
              className="absolute top-1/2 z-20 flex h-5 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm"
              style={{ left: `${left}%` }}
              aria-hidden
            >
              <span className="h-4 w-px rounded-full bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,.42)]" />
            </span>
          ))}
          <span
            className="absolute top-1/2 left-0 z-30 size-4 -translate-y-1/2 rounded-full border-2 border-[color:var(--hl,#10b981)] bg-white shadow-[0_1px_6px_rgba(0,0,0,.45)]"
            aria-hidden
          />
        </div>
        <span className="min-w-[2.55rem] font-mono text-[11px] text-white/75 tabular-nums">
          0:05
        </span>
      </div>

      <div className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white">
        <Maximize2 size={15} strokeWidth={2} />
      </div>
    </div>
  );
}

function AdminFilterControlsSkeleton({
  searchPlaceholder,
  actionLabel,
}: {
  searchPlaceholder: string;
  actionLabel?: string;
}) {
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
        {actionLabel ? (
          <Button
            type="button"
            size="md"
            tabIndex={-1}
            aria-disabled
            className="pointer-events-none"
          >
            <Plus size={16} />
            {actionLabel}
          </Button>
        ) : (
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
        )}
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
      className="bg-card h-full max-h-full"
    >
      <table className={tableClasses(tableClassName)} aria-label="Loading table">
        <thead className={tableHeadClasses()}>
          <tr>
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className={tableHeaderCellClasses(
                  header === 'Open' || header === 'Actions' ? 'text-right' : undefined,
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
  const padding = rowSize === 'relaxed' ? 'py-5' : 'py-3';
  return header === 'Open' || header === 'Actions' ? `${padding} text-right` : padding;
}

function AdminTablePaginationSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-4 w-44 max-w-full" />
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
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
    <div className="border-border bg-card rounded-lg border p-5">
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
    <div className="space-y-6" aria-label="Loading replay">
      <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
        <div className="relative h-[min(72vh,680px)] min-h-[520px] overflow-hidden bg-[#020409]">
          <ReplayPanelLoadingStage />
          <Skeleton className="absolute top-6 right-6 z-20 h-9 w-9 rounded-full bg-white/12" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-stretch">
        <div className="border-border bg-card rounded-lg border p-6 xl:col-span-2">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>
          <DataTableShell>
            <table className={tableClasses('min-w-0 table-fixed')} aria-label="Loading cues">
              <colgroup>
                <col className="w-[88px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[56px]" />
              </colgroup>
              <thead className={tableHeadClasses()}>
                <tr>
                  {['Time', 'Firework', 'Mortar', 'Actions'].map((header) => (
                    <th
                      key={header}
                      className={tableHeaderCellClasses(
                        header === 'Actions' ? 'text-right' : undefined,
                      )}
                    >
                      {header === 'Actions' ? <span className="sr-only">Actions</span> : header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className={tableRowClasses()}>
                    <td className={tableCellClasses('h-14')}>
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className={tableCellClasses('h-14')}>
                      <Skeleton className="h-4 w-full max-w-56" />
                    </td>
                    <td className={tableCellClasses('h-14')}>
                      <Skeleton className="h-4 w-14" />
                    </td>
                    <td className={tableCellClasses('h-14 text-right')}>
                      <Skeleton className="ml-auto h-8 w-8 rounded-full" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[4.25rem] rounded-lg" />
            ))}
          </div>
          <div className="border-border bg-card rounded-lg border p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
            <Skeleton className="mt-4 h-32 rounded-xl" />
            <div className="mt-3 flex justify-end">
              <Skeleton className="h-9 w-36 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton matching the song-context tab on the show detail route. */
export function SongContextSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading song context">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="border-outline-variant/55 bg-surface-container-low rounded-lg border p-4"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-2 h-3 w-36 max-w-full" />
          </div>
        ))}
      </div>

      <div className="border-border bg-card rounded-lg border p-6">
        <div className="mb-5 space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <div className="bg-surface-container-low rounded-md p-4">
          <div className="space-y-3">
            {Array.from({ length: 14 }).map((_, index) => (
              <Skeleton key={index} className={index % 4 === 0 ? 'h-3 w-3/5' : 'h-3 w-full'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton matching the shopping-list card on the show detail route. */
export function ShoppingListSkeleton() {
  return (
    <div className="max-w-3xl" aria-label="Loading shopping list">
      <div className="border-border bg-card rounded-lg border p-8">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        </header>

        <div className="mt-6 flex items-center gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-12" />
        </div>

        <div className="mt-6 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="border-outline-variant/10 bg-surface-container-highest/40 flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
          ))}
        </div>

        <div className="border-outline-variant/10 mt-6 flex items-center justify-between border-t pt-6">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
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
