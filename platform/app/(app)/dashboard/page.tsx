/** Authenticated dashboard landing page with the V1 workspace redesign. */

import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  EmptyShowsPanel,
  JumpBackInHero,
  ShowSummaryRow,
  TemplateSummaryCardView,
} from '@/app/components/app/ShowSummaryCards';
import { getDashboardSummary } from '@/lib/show-summary.server';
import DashboardLoading from './loading';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const summary = await getDashboardSummary();
  const latestShow = summary.recentShows[0] ?? null;
  const secondaryShows = summary.recentShows.slice(1, 5);
  const hasOneShow = summary.showCount === 1;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      {latestShow ? (
        <>
          <JumpBackInHero show={latestShow} />

          {hasOneShow ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-[color:var(--color-content-subtle)]">
                  Or start from a template
                </h2>
                <Link
                  href="/library"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-content-emphasis)] hover:underline"
                >
                  Explore all
                  <ArrowRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {summary.communityTemplates.map((template) => (
                  <TemplateSummaryCardView key={template.id} template={template} showCloneAction />
                ))}
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-[color:var(--color-content-subtle)]">
                  Recent shows
                </h2>
                <Link
                  href="/shows"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-content-emphasis)] hover:underline"
                >
                  View all {summary.showCount}
                  <ArrowRight size={14} />
                </Link>
              </div>
              <div className="bg-card overflow-hidden rounded-xl border border-[color:var(--color-border-subtle)]">
                {secondaryShows.map((show) => (
                  <ShowSummaryRow key={show.id} show={show} />
                ))}
              </div>
            </section>
          )}

          {summary.communityTemplates.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-[color:var(--color-content-subtle)]">
                From the community
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {summary.communityTemplates.map((template) => (
                  <TemplateSummaryCardView key={template.id} template={template} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <EmptyShowsPanel templates={summary.communityTemplates} />
      )}
    </div>
  );
}
