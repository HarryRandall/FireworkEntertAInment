/** Direct export surface for generated show timelines. */

import { Suspense } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/components/design-system/DataTable';
import { Skeleton } from '@/components/design-system/Feedback';
import { SectionHeader } from '@/components/design-system/SectionHeader';
import { ListSkeleton } from '@/components/shell/RouteSkeletons';
import { ShowExportButton } from '@/components/shows/ShowExportButton';
import { getDashboardSummary } from '@/lib/show-summary.server';
import { formatDuration } from '@/lib/show-domain';

/** Static intro card chrome; the CTA slot depends on show data. */
function ExportsIntroCard({ cta }: { cta: React.ReactNode }) {
  return (
    <Card radius="xl" className="p-6">
      <div className="flex max-w-2xl items-start gap-4">
        <span className="bg-muted text-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
          <Download size={18} aria-hidden="true" />
        </span>
        <div className="space-y-3">
          <div>
            <h2 className="text-foreground text-base font-medium">Download a Finale 3D CSV</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Export a generated cue timeline with its product and launch-position details.
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
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Export files</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Download Finale 3D-compatible CSV files from shows that have generated cues.
        </p>
      </header>
      <Suspense fallback={<ExportsLoadingSkeleton />}>
        <ExportsContent />
      </Suspense>
    </div>
  );
}

async function ExportsContent() {
  const summary = await getDashboardSummary();
  const recentShows = summary.allShows.filter((show) => show.cueCount > 0).slice(0, 5);

  return (
    <>
      <ExportsIntroCard
        cta={
          recentShows[0] ? (
            <ShowExportButton
              showSlug={recentShows[0].slug}
              label="Download latest CSV"
              variant="secondary"
            />
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
                  <th scope="col" className={tableHeaderCellClasses()}>
                    Show
                  </th>
                  <th scope="col" className={tableHeaderCellClasses()}>
                    Length
                  </th>
                  <th scope="col" className={tableHeaderCellClasses()}>
                    Cues
                  </th>
                  <th scope="col" className={tableHeaderCellClasses('text-right')}>
                    Export
                  </th>
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
                      {show.cueCount.toLocaleString('en-AU')}
                    </td>
                    <td className={tableCellClasses('text-right')}>
                      <ShowExportButton
                        showSlug={show.slug}
                        label="Download CSV"
                        variant="secondary"
                        className="text-xs"
                        showIcon
                      />
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
