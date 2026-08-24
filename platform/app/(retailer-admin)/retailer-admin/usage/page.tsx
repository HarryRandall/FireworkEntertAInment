/** Retailer-admin usage: shows generated + credits spent, and which assortments pull their weight. Static preview data (see FIR-166). */

import { Card, SectionHeader, StatTile } from '@/app/components/ui';
import { PreviewNotice } from '../_components/PreviewNotice';
import {
  DUMMY_TOP_ASSORTMENTS_BY_USAGE,
  DUMMY_USAGE_LAST_7_DAYS,
  DUMMY_USAGE_STATS,
} from '../_lib/dummy-data';

export default function RetailerAdminUsagePage() {
  const maxDay = Math.max(...DUMMY_USAGE_LAST_7_DAYS, 1);
  const maxShows = Math.max(...DUMMY_TOP_ASSORTMENTS_BY_USAGE.map((row) => row.shows), 1);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <SectionHeader
        title="Usage"
        description="See what shoppers are actually generating: volume, spend, and which packs pull their weight."
      />

      <PreviewNotice>
        Usage isn&apos;t tracked per retailer yet, so these figures are
        illustrative only.
      </PreviewNotice>

      <div className="grid grid-cols-2 gap-3 sm:w-fit">
        <StatTile label="This week" value={DUMMY_USAGE_STATS.showsThisWeek} unit="shows" />
        <StatTile
          label="Credits spent"
          value={DUMMY_USAGE_STATS.creditsSpentThisWeek.toLocaleString()}
        />
      </div>

      <Card className="p-5" shadow>
        <h3 className="text-foreground mb-4 text-sm font-semibold">Shows generated · last 7 days</h3>
        <div aria-hidden className="flex h-32 items-end gap-2">
          {DUMMY_USAGE_LAST_7_DAYS.map((value, index) => (
            <div
              key={index}
              className={
                index === DUMMY_USAGE_LAST_7_DAYS.length - 1
                  ? 'bg-primary flex-1 rounded-t-sm'
                  : 'bg-muted flex-1 rounded-t-sm'
              }
              style={{ height: `${Math.max((value / maxDay) * 100, 6)}%` }}
            />
          ))}
        </div>
      </Card>

      <Card className="p-5" shadow>
        <h3 className="text-foreground mb-4 text-sm font-semibold">Assortments by usage</h3>
        <div className="flex flex-col gap-3">
          {DUMMY_TOP_ASSORTMENTS_BY_USAGE.map((row) => (
            <div key={row.name} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground min-w-0 truncate font-medium">{row.name}</span>
                <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
                  {row.shows} shows · {row.credits}cr
                </span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.max((row.shows / maxShows) * 100, 6)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
