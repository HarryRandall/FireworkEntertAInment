/** Exports page for generated files and download history. */

import { Suspense } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { Skeleton } from '@/app/components/ui/Feedback';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { ListSkeleton } from '@/app/components/app/RouteSkeletons';
import { getDashboardSummary } from '@/lib/show-summary.server';
import { formatDuration } from '@/lib/show-domain';

/** Static intro card chrome; the CTA slot depends on show data. */
function ExportsIntroCard({ cta }: { cta: React.ReactNode }) {
  return (
    <Card radius="xl" className="p-6">
      <div className="flex max-w-2xl items-start gap-4">
        <span className="bg-muted text-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
          <Download size={18} />
        </span>
        <div className="space-y-3">
          <div>
            <h2 className="text-foreground text-base font-medium">No exported files yet</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Open a show preview to create cue sheets, guides, and production exports.
            </p>
          </div>
          {cta}
        </div>
      </div>
    </Card>
  );
}

function ExportsLoadingSkeleton() {
  return (
    <>
      <ExportsIntroCard cta={<Skeleton className="h-8 w-36 rounded-md" />} />
      <ListSkeleton rows={4} />
    </>
  );
}

export default function ExportsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Suspense fallback={<ExportsLoadingSkeleton />}>
        <ExportsContent />
      </Suspense>
    </div>
  );
}

async function ExportsContent() {
  const summary = await getDashboardSummary();
  const recentShows = summary.recentShows.slice(0, 5);

  return (
    <>
      <ExportsIntroCard
        cta={
          recentShows[0] ? (
            <Button href={`/shows/${recentShows[0].slug}/preview`} variant="secondary" size="sm">
              Open latest show
            </Button>
          ) : (
            <Button href="/shows/new" variant="secondary" size="sm">
              Create a show
            </Button>
          )
        }
      />

      {recentShows.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader size="sm" title="Shows ready to export" />
          <DataTableShell>
            <table className={tableClasses('min-w-[560px]')}>
              <thead className={tableHeadClasses()}>
                <tr>
                  <th className={tableHeaderCellClasses()}>Show</th>
                  <th className={tableHeaderCellClasses()}>Length</th>
                  <th className={tableHeaderCellClasses()}>Cues</th>
                  <th className={tableHeaderCellClasses('text-right')}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentShows.map((show) => (
                  <tr key={show.id} className={tableRowClasses('hover:bg-muted/45')}>
                    <td className={tableCellClasses()}>
                      <div className="text-foreground font-medium">{show.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {show.songTitle ?? 'Untitled track'}
                      </div>
                    </td>
                    <td className={tableCellClasses('font-mono text-xs tabular-nums')}>
                      {formatDuration(show.lengthSeconds)}
                    </td>
                    <td className={tableCellClasses('font-mono text-xs tabular-nums')}>
                      {show.cueCount}
                    </td>
                    <td className={tableCellClasses('text-right')}>
                      <Button
                        href={`/shows/${show.slug}/preview`}
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                      >
                        <FileText size={13} />
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </section>
      ) : null}
    </>
  );
}
