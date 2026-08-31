'use client';

/** Activity chart visualising the user's recent events on the admin user detail page. */

import dynamic from 'next/dynamic';

export type UserActivityDatum = { date: string; count: number };

const LazyUserActivityChartPlot = dynamic(
  () => import('./UserActivityChartPlot').then((module) => module.UserActivityChartPlot),
  {
    loading: () => (
      <div
        aria-label="Loading activity chart"
        className="h-44 w-full rounded-md bg-[color:var(--color-bg-subtle)]"
        role="status"
      />
    ),
    ssr: false,
  },
);

export function UserActivityChart({ data }: { data: UserActivityDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-md border border-dashed border-[color:var(--color-border-subtle)] text-sm text-[color:var(--color-content-subtle)]">
        No show activity in the last 30 days.
      </div>
    );
  }

  return <LazyUserActivityChartPlot data={data} />;
}
