/** Admin route skeletons; each mirrors its page so loading does not shift layout. */
import { ChevronRight, Save } from 'lucide-react';
import { ReplayPanelLoadingStage } from '@/ui/replay/ReplayPanelLoadingStage';
import { Button } from '@/ui/patterns/Button';
import { Skeleton } from '@/ui/patterns/Feedback';
import {
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/ui/patterns/DataTable';
import { cn } from '@/lib/utils';
import {
  FilterControlsSkeleton,
  TableRowsSkeleton,
  type TableSkeletonRowSize,
} from '@/ui/shell/RouteSkeletons';

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

function AdminOverviewDashboardContentSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading admin overview content"
    >
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
    <div
      className="flex-1 text-sm outline-none"
      role="status"
      aria-busy="true"
      aria-label="Loading catalogue overview"
    >
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
    <div
      className="flex-1 text-sm outline-none"
      role="status"
      aria-busy="true"
      aria-label="Loading import pipeline"
    >
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
      role="status"
      aria-busy="true"
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
function AdminUserHeaderSkeleton() {
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
      <section
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        role="status"
        aria-busy="true"
        aria-label="Loading user stats"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-border bg-card rounded-lg border px-4 py-3">
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </section>
      <div
        className="border-border bg-card rounded-xl border p-5"
        role="status"
        aria-busy="true"
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

/** AI credit KPI and ledger skeleton for the admin user detail page. */
function AdminUserAiCreditsSkeleton() {
  return (
    <div
      className="border-border bg-card rounded-xl border p-5"
      role="status"
      aria-busy="true"
      aria-label="Loading AI credits"
    >
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>
      <section className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-border bg-card rounded-lg border px-4 py-3">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </section>
      <div className="mt-5">
        <Skeleton className="mb-2 h-3 w-24" />
        <div className="divide-border divide-y">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 text-sm">
              <div className="space-y-2">
                <Skeleton className="h-4 w-44 max-w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Role card skeleton for the admin user detail page. */
export function AdminUserRoleSkeleton() {
  return (
    <div
      className="border-border bg-card rounded-xl border p-5"
      role="status"
      aria-busy="true"
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
      className="border-border bg-card rounded-xl border p-5"
      role="status"
      aria-busy="true"
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
    <div
      className="mx-auto w-full max-w-[1200px] space-y-8"
      role="status"
      aria-busy="true"
      aria-label="Loading user detail"
    >
      <AdminUserHeaderSkeleton />
      <AdminUserRoleSkeleton />
      <AdminUserActivitySkeleton />
      <AdminUserAiCreditsSkeleton />
      <AdminUserPermissionsSkeleton />
      <Skeleton className="h-3 w-44" />
    </div>
  );
}

/** Skeleton for the admin roles permission matrix route. */
export function AdminRolesSkeleton() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="Loading roles"
    >
      <FilterControlsSkeleton searchPlaceholder="Search permissions by name or area..." />

      <div className="space-y-3">
        {['Platform access', 'Show builder', 'Supplier workspace'].map((group, groupIndex) => (
          <div
            key={group}
            className="border-border bg-background overflow-hidden rounded-lg border"
          >
            <div className="flex items-center gap-2 px-4 py-4 text-sm font-medium">
              <ChevronRight
                aria-hidden
                className={groupIndex === 0 ? 'size-4 rotate-90' : 'size-4'}
              />
              {group}
              <Skeleton className="h-5 w-7 rounded-sm" />
            </div>
            {groupIndex === 0 ? (
              <div className="border-border overflow-x-auto border-t">
                <table className={tableClasses('table-fixed')} aria-label="Loading role defaults">
                  <colgroup>
                    <col />
                    {[0, 1, 2].map((role) => (
                      <col key={role} className="w-32 lg:w-40" />
                    ))}
                  </colgroup>
                  <thead className={tableHeadClasses()}>
                    <tr>
                      {['Permission', 'Admin', 'Supplier', 'User'].map((header) => (
                        <th
                          key={header}
                          scope="col"
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
                    {Array.from({ length: 9 }, (_, index) => (
                      <tr key={index} className={tableRowClasses()}>
                        <td className={tableCellClasses()}>
                          <Skeleton className="h-4 w-full max-w-44" />
                        </td>
                        {[0, 1, 2].map((role) => (
                          <td key={role} className={tableCellClasses('text-center')}>
                            <Skeleton className="mx-auto h-8 w-24 rounded-md" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for the admin prompt control route. */
export function AdminPromptsSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-5"
      role="status"
      aria-busy="true"
      aria-label="Loading prompts"
    >
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
  searchPlaceholder = 'Search…',
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
  rowSize?: TableSkeletonRowSize;
  hasAction?: boolean;
  filterActionLabel?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8"
      aria-label={ariaLabel}
    >
      {hasAction ? (
        <div className="flex justify-end">
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      ) : null}
      <FilterControlsSkeleton
        searchPlaceholder={searchPlaceholder}
        actionLabel={filterActionLabel}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <TableRowsSkeleton
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
/** Skeleton for the admin import review route. */
/** Skeleton for admin effect editor detail pages. */
export function AdminEffectEditorSkeleton() {
  return <AdminVisualEditorSkeleton label="Loading effect editor" />;
}

/** Skeleton for product-level firework editor detail pages. */
export function AdminFireworkEditorSkeleton() {
  return <AdminVisualEditorSkeleton label="Loading firework editor" />;
}

/** Skeleton for the multishot editor, preserving the preview, inspector, timeline and meta chrome. */
export function AdminMultishotEditorSkeleton() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-5"
      role="status"
      aria-busy="true"
      aria-label="Loading multishot editor"
    >
      <div className="grid shrink-0 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="bg-stage-night border-border relative h-[560px] overflow-hidden rounded-lg border text-white">
          <ReplayPanelLoadingStage />
        </section>

        <aside className="border-border bg-card flex max-h-[560px] min-h-0 flex-col gap-3 overflow-hidden rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <div className="border-border space-y-3 border-t pt-3">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
          <div className="border-border mt-auto grid grid-cols-2 gap-2 border-t pt-3">
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
          </div>
        </aside>
      </div>

      <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="border-border overflow-hidden rounded-md border">
          <div className="border-border bg-muted h-6 border-b" />
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-7 rounded-md" />
            ))}
          </div>
        </div>
      </section>

      <section className="border-border bg-card rounded-lg border px-3 py-2.5 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </section>
    </div>
  );
}

/** Shared preview, inspector and parts layout while editor records load. */
export function AdminStyleDefaultEditorSkeleton() {
  return (
    <AdminVisualEditorSkeleton
      label="Loading style default editor"
      parts={['Preset settings', 'Utilities']}
    />
  );
}

function AdminVisualEditorSkeleton({
  label,
  parts = ['Launch', 'Burst', 'Trails', 'Extra effects', 'Timing', 'Sound', 'Utilities'],
}: {
  label: string;
  parts?: string[];
}) {
  return (
    <div
      className="bg-background flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      aria-label={label}
      aria-busy="true"
    >
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_256px_168px] lg:overflow-hidden">
        <section className="bg-stage-night relative min-h-[320px] overflow-hidden text-white lg:min-h-0">
          <ReplayPanelLoadingStage />
        </section>
        <aside
          className="border-border min-w-0 border-t lg:border-t-0 lg:border-l"
          aria-label="Loading settings"
        >
          <div className="space-y-5 p-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="space-y-2" key={index}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </aside>
        <aside className="border-border hidden border-l p-2 lg:block" aria-label="Firework parts">
          {parts.map((part) => (
            <div
              key={part}
              className="text-muted-foreground flex items-center gap-1 px-2 py-1.5 text-xs font-semibold"
            >
              <ChevronRight size={12} />
              {part}
            </div>
          ))}
        </aside>
      </div>
      <div className="border-border flex items-center justify-end gap-2 border-t px-3 py-2">
        <Skeleton className="mr-auto h-3 w-16" />
        <Skeleton className="h-8 w-24" />
        <Button size="sm" disabled>
          <Save size={15} />
          Save
        </Button>
      </div>
    </div>
  );
}

/** Data-shaped replay fallback for an Explore template detail page. */
