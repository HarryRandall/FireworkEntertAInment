/** Admin imports page for upload, monitoring and review. */

import { Suspense } from 'react';
import { FileVideo2, UploadCloud } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeaderCellClasses,
  tableHeadClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { EmptyState, Skeleton } from '@/app/components/ui/Feedback';
import { FilterBar, type FilterConfig } from '@/app/components/ui/FilterBar';
import { TablePagination, TABLE_PAGE_SIZE } from '@/app/components/ui/TablePagination';
import { listImportJobs } from '@/lib/admin.server';
import { importStageLabel, importStatusTone } from '@/lib/import-review';
import { ImportJobCard } from './ImportJobCard';
import { ImportJobRowActions } from './ImportJobRowActions';
import { VideoImportUploadForm } from './VideoImportUploadForm';

type SearchParams = { q?: string; status?: string; page?: string; view?: string };
type PageProps = { searchParams: Promise<SearchParams> };

const STATUS_FILTERS: FilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'queued', label: 'Queued' },
      { value: 'processing', label: 'Processing' },
      { value: 'needs_review', label: 'Needs review' },
      { value: 'failed', label: 'Failed' },
      { value: 'complete', label: 'Complete' },
    ],
  },
];

export default async function AdminImportsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const archivedView = resolvedSearchParams.view === 'archived';
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <header className="space-y-1">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">
          Firework imports
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm text-pretty">
          Reconstruct supplier footage, compare retained evidence and publish validated fireworks.
        </p>
      </header>

      <Card className="p-5 sm:p-6" shadow>
        <div className="mb-5 flex items-start gap-3">
          <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg">
            <UploadCloud size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-foreground text-lg font-semibold">Reconstruct from video</h2>
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
              Upload source footage for frame, colour, trajectory and timing analysis. Processing
              creates immutable candidates for comparison before anything is published.
            </p>
          </div>
        </div>
        <VideoImportUploadForm />
      </Card>

      <section aria-labelledby="import-jobs-heading" className="space-y-4">
        <div>
          <h2 id="import-jobs-heading" className="text-foreground text-lg font-semibold">
            Reconstruction jobs
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Video lifecycle fields are worker-managed. Open a job to review its runs and evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Import job view">
          <Button
            href={importViewHref(resolvedSearchParams, 'active')}
            size="sm"
            variant={archivedView ? 'secondary' : 'primary'}
            aria-current={archivedView ? undefined : 'page'}
          >
            Active
          </Button>
          <Button
            href={importViewHref(resolvedSearchParams, 'archived')}
            size="sm"
            variant={archivedView ? 'primary' : 'secondary'}
            aria-current={archivedView ? 'page' : undefined}
          >
            Archived audit
          </Button>
        </div>
        <Suspense fallback={<ImportTableSkeleton />}>
          <ImportJobList searchParams={resolvedSearchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function ImportJobList({ searchParams }: { searchParams: SearchParams }) {
  const archivedView = searchParams.view === 'archived';
  const jobs = await listImportJobs(archivedView ? 'archived' : 'active');
  const videoJobs = jobs.filter((job) => job.kind === 'firework_video');
  const metadataJobs = jobs.filter((job) => job.kind !== 'firework_video');
  const query = searchParams.q?.trim().toLowerCase() ?? '';
  const status = searchParams.status?.trim() ?? '';
  const filtered = videoJobs.filter(
    (job) =>
      (!query ||
        job.sourceName.toLowerCase().includes(query) ||
        job.selectedModel?.toLowerCase().includes(query)) &&
      (!status || job.status === status),
  );
  const requestedPage = Number.parseInt(searchParams.page ?? '1', 10);
  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(
    totalPages,
    Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1),
  );
  const pageJobs = filtered.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  );

  return (
    <div className="space-y-5">
      <FilterBar
        searchPlaceholder="Search source or model…"
        filters={STATUS_FILTERS}
        className="max-w-3xl"
      />
      {pageJobs.length > 0 ? (
        <DataTableShell
          caption={`${filtered.length.toLocaleString()} video ${filtered.length === 1 ? 'job' : 'jobs'}`}
          footer={
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              searchParams={searchParams}
              visibleItems={pageJobs.length}
              totalItems={filtered.length}
              itemLabel="job"
            />
          }
        >
          <table className={tableClasses('min-w-[920px]')}>
            <thead className={tableHeadClasses()}>
              <tr>
                <th className={tableHeaderCellClasses()}>Source</th>
                <th className={tableHeaderCellClasses()}>Stage</th>
                <th className={tableHeaderCellClasses()}>Progress</th>
                <th className={tableHeaderCellClasses()}>Model</th>
                <th className={tableHeaderCellClasses()}>Updated</th>
                <th className={tableHeaderCellClasses('text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageJobs.map((job) => (
                <tr key={job.id} className={tableRowClasses('hover:bg-muted/35')}>
                  <td className={tableCellClasses('max-w-[320px] whitespace-normal')}>
                    <div className="flex items-start gap-3">
                      <span className="bg-muted text-muted-foreground mt-0.5 grid size-8 shrink-0 place-items-center rounded-md">
                        <FileVideo2 size={15} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-medium">{job.sourceName}</p>
                        {job.errorMessage ? (
                          <p className="text-destructive mt-1 line-clamp-2 text-xs">
                            {job.errorMessage}
                          </p>
                        ) : (
                          <p className="text-muted-foreground mt-1 font-mono text-xs">
                            {job.id.slice(0, 8)}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={tableCellClasses()}>
                    <Badge solid tone={importStatusTone(job.status)}>
                      {importStageLabel(job.status)}
                    </Badge>
                  </td>
                  <td className={tableCellClasses('w-[150px]')}>
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                        <span>{job.status === 'needs_review' ? 'Ready' : 'Worker'}</span>
                        <span className="font-mono tabular-nums">{job.processingProgress}%</span>
                      </div>
                      <div
                        className="bg-muted h-1.5 overflow-hidden rounded-full"
                        role="progressbar"
                        aria-label={`${job.sourceName} processing progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={job.processingProgress}
                      >
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, job.processingProgress))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className={tableCellClasses('max-w-[220px] truncate font-mono text-xs')}>
                    {job.selectedModel ?? 'Not selected'}
                  </td>
                  <td className={tableCellClasses('text-muted-foreground font-mono text-xs')}>
                    {formatDateTime(job.updatedAt)}
                  </td>
                  <td className={tableCellClasses()}>
                    <ImportJobRowActions
                      id={job.id}
                      sourceName={job.sourceName}
                      archived={archivedView}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      ) : (
        <EmptyState
          icon={<FileVideo2 size={24} aria-hidden="true" />}
          title={
            videoJobs.length === 0
              ? archivedView
                ? 'No archived reconstruction jobs'
                : 'No reconstruction jobs yet'
              : 'No jobs match these filters'
          }
        >
          {videoJobs.length === 0
            ? archivedView
              ? 'Archived runs and evidence will remain available here for audit.'
              : 'Upload source footage above to create the first reconstruction run.'
            : 'Clear the search or status filter to see other jobs.'}
        </EmptyState>
      )}

      {metadataJobs.length > 0 ? (
        <section aria-labelledby="metadata-imports-heading" className="space-y-3">
          <div>
            <h3 id="metadata-imports-heading" className="text-foreground font-semibold">
              Other import metadata
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {archivedView
                ? 'Archived non-video records remain visible as read-only audit evidence.'
                : 'Existing non-video import records retain their editable metadata controls.'}
            </p>
          </div>
          {metadataJobs.map((job) => (
            <ImportJobCard key={job.id} job={job} readOnly={archivedView} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ImportTableSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading reconstruction jobs">
      <Skeleton className="h-10 max-w-3xl" />
      <DataTableShell caption="Loading reconstruction jobs">
        <table className={tableClasses('min-w-[920px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              {['Source', 'Stage', 'Progress', 'Model', 'Updated', 'Actions'].map((label) => (
                <th
                  key={label}
                  className={tableHeaderCellClasses(label === 'Actions' ? 'text-right' : undefined)}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, index) => (
              <tr key={index} className={tableRowClasses()}>
                <td className={tableCellClasses()}>
                  <Skeleton className="h-9 w-64" />
                </td>
                <td className={tableCellClasses()}>
                  <Skeleton className="h-6 w-24" />
                </td>
                <td className={tableCellClasses()}>
                  <Skeleton className="h-6 w-32" />
                </td>
                <td className={tableCellClasses()}>
                  <Skeleton className="h-6 w-40" />
                </td>
                <td className={tableCellClasses()}>
                  <Skeleton className="h-6 w-28" />
                </td>
                <td className={tableCellClasses()}>
                  <Skeleton className="ml-auto h-9 w-28" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}

function importViewHref(searchParams: SearchParams, view: 'active' | 'archived'): string {
  const params = new URLSearchParams();
  const query = searchParams.q?.trim();
  const status = searchParams.status?.trim();
  if (query) params.set('q', query);
  if (status) params.set('status', status);
  if (view === 'archived') params.set('view', 'archived');
  const encoded = params.toString();
  return encoded ? `/admin/imports?${encoded}` : '/admin/imports';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
