/** Dashboard compositions combine existing cards and Radix tabs with filterable breakdowns. */
'use client';
import { useState } from 'react';
import { Tabs, Modal } from './overlays';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { StatCard } from './stat-card';

// The prototype shows six breakdown rows before opening its searchable full list.
const PREVIEW_ROWS = 6;
const FULL_PERCENT = 100;
/** Ranked labelled counts for one facet. */
export interface BreakdownTab {
  label: string;
  facet: string;
  rows: { label: string; value: number; description?: string }[];
}
function BreakdownRows({
  tab,
  onPick,
  query = '',
  limit = tab.rows.length,
}: {
  tab: BreakdownTab;
  onPick: (facet: string, value: string) => void;
  query?: string;
  limit?: number;
}) {
  const maximum = Math.max(1, ...tab.rows.map((row) => row.value));
  const rows = tab.rows
    .filter((row) => row.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, limit);
  return (
    <div className="grid gap-1">
      {rows.map((row) => (
        <button
          key={row.label}
          type="button"
          className="hover:bg-muted relative flex min-h-10 items-center gap-2 overflow-hidden rounded-lg px-3 text-left text-sm"
          onClick={() => {
            onPick(tab.facet, row.label);
          }}
        >
          <span
            aria-hidden="true"
            className="bg-highlight-soft absolute inset-y-1 left-0 rounded"
            style={{ width: `${String((row.value / maximum) * FULL_PERCENT)}%` }}
          />
          <span className="relative flex-1">
            {row.label}
            <small className="text-muted-foreground ml-2">{row.description}</small>
          </span>
          <b className="relative tabular-nums">{row.value.toLocaleString('en-GB')}</b>
        </button>
      ))}
      {rows.length === 0 && (
        <p className="text-muted-foreground text-sm">No matching breakdowns.</p>
      )}
    </div>
  );
}
function FullBreakdown({
  tab,
  onPick,
}: {
  tab: BreakdownTab;
  onPick: (facet: string, value: string) => void;
}) {
  const [query, setQuery] = useState('');
  return (
    <div className="grid gap-3">
      <Input
        aria-label={`Search ${tab.label}`}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <BreakdownRows tab={tab} onPick={onPick} query={query} />
    </div>
  );
}
/** Uses tabs to choose a ranking; each row adds or replaces its corresponding dashboard facet. */
export function BreakdownCard({
  title,
  tabs,
  onPick,
}: {
  title: string;
  tabs: BreakdownTab[];
  onPick: (facet: string, value: string) => void;
}) {
  if (tabs.length === 0) return <p>No breakdown data.</p>;
  return (
    <section className="border-border bg-card min-w-0 rounded-xl border p-4" aria-label={title}>
      <h4 className="mb-3 font-semibold">{title}</h4>
      <Tabs
        defaultValue={tabs[0].label}
        items={tabs.map((tab) => ({
          value: tab.label,
          label: tab.label,
          content: (
            <>
              <BreakdownRows tab={tab} onPick={onPick} limit={PREVIEW_ROWS} />
              {tab.rows.length > PREVIEW_ROWS && (
                <Modal
                  title={`${title}: ${tab.label}`}
                  description="Search all breakdown rows and choose one to filter the dashboard."
                  side
                  trigger={<Button variant="ghost">View all {tab.rows.length}</Button>}
                >
                  <FullBreakdown tab={tab} onPick={onPick} />
                </Modal>
              )}
            </>
          ),
        }))}
      />
    </section>
  );
}
/** Arranges labelled KPI counts and finite-valued trends in responsive cards. */
export function KpiRow({
  metrics,
}: {
  metrics: { title: string; value: string; change: string; series: readonly number[] }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <StatCard key={metric.title} {...metric} />
      ))}
    </div>
  );
}
/** Displays dated synthetic or consumer-provided events with accessible ISO timestamps. */
export function ActivityFeed({
  title,
  items,
}: {
  title: string;
  items: {
    id: string;
    title: string;
    description: string;
    at: string;
    when: string;
    href?: string;
  }[];
}) {
  return (
    <section className="border-border bg-card rounded-xl border p-4" aria-label={title}>
      <h4 className="font-semibold">{title}</h4>
      <ol className="mt-3 grid gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-border flex flex-wrap justify-between gap-2 border-b pb-3 text-sm"
          >
            <div>
              {item.href !== undefined && item.href.length > 0 ? (
                <a className="underline" href={item.href}>
                  {item.title}
                </a>
              ) : (
                <b>{item.title}</b>
              )}
              <p className="text-muted-foreground text-xs">{item.description}</p>
            </div>
            <time className="text-muted-foreground text-xs" dateTime={item.at}>
              {item.when}
            </time>
          </li>
        ))}
      </ol>
      {items.length === 0 && (
        <p className="text-muted-foreground mt-3 text-sm">No recent activity.</p>
      )}
    </section>
  );
}
