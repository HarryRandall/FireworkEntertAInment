'use client';

/** Activity chart visualising the user's recent events on the admin user detail page. */

import dynamic from 'next/dynamic';

export type UserActivityDatum = { date: string; count: number };

const LazyUserActivityChartPlot = dynamic(
  () =>
    import('@/app/(admin)/admin/users/[id]/_components/UserActivityChartPlot').then(
      (module) => module.UserActivityChartPlot,
    ),
  {
    loading: () => (
      <div
        aria-busy="true"
        aria-label="Loading activity chart"
        className="bg-secondary h-44 w-full rounded-md"
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
      <div className="border-border text-muted-foreground flex h-44 items-center justify-center rounded-md border border-dashed text-sm">
        No show activity in the last 30 days.
      </div>
    );
  }

  return <LazyUserActivityChartPlot data={data} />;
}
