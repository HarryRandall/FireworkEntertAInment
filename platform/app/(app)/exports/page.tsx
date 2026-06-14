/** Exports page for generated files and download history. */

import Link from 'next/link';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { getDashboardSummary } from '@/lib/show-summary.server';
import { formatDuration } from '@/lib/show-domain';

export default async function ExportsPage() {
  const summary = await getDashboardSummary();
  const recentShows = summary.recentShows.slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Card radius="xl" className="p-6">
        <div className="flex max-w-2xl items-start gap-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-bg-subtle)] text-[color:var(--color-content-emphasis)]">
            <Download size={18} />
          </span>
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-medium text-[color:var(--color-content-emphasis)]">
                No exported files yet
              </h2>
              <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
                Open a show preview to create cue sheets, guides, and production exports.
              </p>
            </div>
            {recentShows[0] ? (
              <Button href={`/shows/${recentShows[0].slug}/preview`} variant="secondary" size="sm">
                Open latest show
              </Button>
            ) : (
              <Button href="/shows/new" variant="secondary" size="sm">
                Create a show
              </Button>
            )}
          </div>
        </div>
      </Card>

      {recentShows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[color:var(--color-content-subtle)]">
            Shows ready to export
          </h2>
          <div className="bg-card overflow-hidden rounded-xl border border-[color:var(--color-border-subtle)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[color:var(--color-border-subtle)] text-xs text-[color:var(--color-content-muted)] uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Show</th>
                    <th className="px-4 py-3 font-medium">Length</th>
                    <th className="px-4 py-3 font-medium">Cues</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentShows.map((show) => (
                    <tr
                      key={show.id}
                      className="border-b border-[color:var(--color-border-subtle)] last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[color:var(--color-content-emphasis)]">
                          {show.title}
                        </div>
                        <div className="text-xs text-[color:var(--color-content-subtle)]">
                          {show.songTitle ?? 'Untitled track'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-content-emphasis)] tabular-nums">
                        {formatDuration(show.lengthSeconds)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-content-emphasis)] tabular-nums">
                        {show.cueCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/shows/${show.slug}/preview`}
                          className="focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-md border border-[color:var(--color-border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-content-emphasis)] transition-colors hover:bg-[color:var(--color-bg-subtle)] focus:outline-none focus-visible:ring-3"
                        >
                          <FileText size={13} />
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
