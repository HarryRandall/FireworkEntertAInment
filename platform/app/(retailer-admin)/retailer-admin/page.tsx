/** Retailer-admin overview: credit balance, shows-today, active-assortments, avg-credits/show, plus a 14-day usage chart and recent activity feed. Static preview data (see FIR-166). */

import { Card, SectionHeader, StatTile } from '@/app/components/ui';
import { PreviewNotice } from './_components/PreviewNotice';
import { DUMMY_OVERVIEW_STATS, DUMMY_RECENT_ACTIVITY, DUMMY_SHOWS_LAST_14_DAYS } from './_lib/dummy-data';

export default function RetailerAdminOverviewPage() {
  const stats = DUMMY_OVERVIEW_STATS;
  const maxShows = Math.max(...DUMMY_SHOWS_LAST_14_DAYS, 1);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <SectionHeader
        title="Overview"
        description="Where a retailer runs their in-store AI experience: catalogue, effects, assortments, usage, model choice, and credits."
      />

      <PreviewNotice>
        These figures are illustrative. Retailer accounts aren&apos;t a scoped
        tenant in the schema yet, so this page isn&apos;t wired to real usage
        or billing data.
      </PreviewNotice>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Credits remaining"
          value={stats.creditsRemaining.toLocaleString()}
          unit={stats.creditsRemainingHint}
        />
        <StatTile
          label="Shows today"
          value={stats.showsToday}
          unit={stats.showsTodayHint}
        />
        <StatTile
          label="Active assortments"
          value={stats.activeAssortments}
          unit={stats.activeAssortmentsHint}
        />
        <StatTile
          label="Avg. credits / show"
          value={stats.avgCreditsPerShow}
          unit={stats.avgCreditsPerShowHint}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3" shadow>
          <h3 className="text-foreground mb-4 text-sm font-semibold">
            Shows generated · last 14 days
          </h3>
          <div aria-hidden className="flex h-28 items-end gap-1.5">
            {DUMMY_SHOWS_LAST_14_DAYS.map((value, index) => (
              <div
                key={index}
                className={
                  index === DUMMY_SHOWS_LAST_14_DAYS.length - 1
                    ? 'bg-primary flex-1 rounded-t-sm'
                    : 'bg-muted flex-1 rounded-t-sm'
                }
                style={{ height: `${Math.max((value / maxShows) * 100, 6)}%` }}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2" shadow>
          <h3 className="text-foreground mb-3 text-sm font-semibold">Recent activity</h3>
          <ul className="divide-border divide-y">
            {DUMMY_RECENT_ACTIVITY.map((item) => (
              <li key={item.text} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
                <span aria-hidden className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                <span className="text-foreground min-w-0 flex-1 text-sm leading-snug">
                  {item.text}
                  {item.amount ? (
                    <span className="text-muted-foreground ml-1.5 font-mono tabular-nums">
                      {item.amount}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                  {item.time}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
