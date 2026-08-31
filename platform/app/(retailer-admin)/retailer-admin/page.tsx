/**
 * Retailer-admin overview. "Active assortments" and "Recent activity" are
 * real, account-scoped data now; credits/shows-today/avg-credits-per-show
 * and the 14-day chart stay illustrative since no retailer-scoped credit
 * ledger or show-generation tracking exists yet (see FIR-166).
 */

import { Card, SectionHeader, StatTile } from '@/app/components/ui';
import { PreviewNotice } from './_components/PreviewNotice';
import { listRetailerAssortments } from './_lib/assortments.server';
import { DUMMY_OVERVIEW_STATS, DUMMY_SHOWS_LAST_14_DAYS } from './_lib/dummy-data';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export default async function RetailerAdminOverviewPage() {
  const stats = DUMMY_OVERVIEW_STATS;
  const assortments = await listRetailerAssortments();
  const maxShows = Math.max(...DUMMY_SHOWS_LAST_14_DAYS, 1);
  const recentAssortments = assortments.slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <SectionHeader
        title="Overview"
        description="Where a retailer runs their in-store AI experience: catalogue, assortments, and credits."
      />

      <PreviewNotice>
        Active assortments and recent activity below are real. Credits, shows
        today, avg. credits/show, and the chart are illustrative — no
        retailer-scoped credit ledger or show-generation tracking exists yet.
      </PreviewNotice>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Credits remaining"
          value={stats.creditsRemaining.toLocaleString()}
          unit={stats.creditsRemainingHint}
        />
        <StatTile label="Shows today" value={stats.showsToday} unit={stats.showsTodayHint} />
        <StatTile label="Active assortments" value={assortments.length} />
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
          {recentAssortments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No assortments yet — head to Assortments to create one.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {recentAssortments.map((assortment) => {
                const wasEdited = assortment.updatedAt !== assortment.createdAt;
                return (
                  <li
                    key={assortment.id}
                    className="flex items-start gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <span
                      aria-hidden
                      className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    />
                    <span className="text-foreground min-w-0 flex-1 truncate text-sm leading-snug">
                      Assortment {wasEdited ? 'updated' : 'created'} · {assortment.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                      {relativeTime(assortment.updatedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
