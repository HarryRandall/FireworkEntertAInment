/** Facet, calendar and comparison controls composed from the shared registry kit. */
'use client';
import { useState } from 'react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { ActionMenu, Modal } from './overlays';
import {
  removeFacet,
  setFacet,
  trailingRange,
  validRange,
  type DashboardState,
} from './dashboard-logic';

// The prototype's named trailing periods are inclusive UTC calendar days.
const WEEK_DAYS = 7;
const REVIEW_DAYS = 21;
const RANGE_DAYS = [1, WEEK_DAYS, REVIEW_DAYS];
/** Edits a controlled dashboard view; sharing and exporting stay consumer-owned actions. */
export function DashboardFilterBar({
  state,
  facets,
  today,
  presets = [],
  onChange,
  onShare,
  onExport,
}: {
  state: DashboardState;
  facets: Record<string, readonly string[]>;
  today: string;
  presets?: readonly { label: string; range: DashboardState['range'] }[];
  onChange: (state: DashboardState) => void;
  onShare: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Dashboard filters" role="group">
      <ActionMenu
        trigger={<Button variant="outline">Filter</Button>}
        actions={Object.entries(facets).flatMap(([facet, values]) =>
          values.map((value) => ({
            label: `${facet}: ${value}`,
            onSelect: () => {
              onChange({ ...state, filters: setFacet(state.filters, { facet, value }) });
            },
          })),
        )}
      />
      <ActionMenu
        trigger={<Button variant="outline">Date range</Button>}
        actions={[
          ...RANGE_DAYS.map((days) => ({
            label: days === 1 ? 'Today' : `Last ${String(days)} days`,
            onSelect: () => {
              onChange({ ...state, range: trailingRange(today, days) });
            },
          })),
          ...presets.map((preset) => ({
            label: preset.label,
            onSelect: () => {
              onChange({ ...state, range: preset.range });
            },
          })),
        ]}
      />
      <Modal
        title="Custom date range"
        description="Choose inclusive calendar dates."
        trigger={<Button variant="outline">Custom range</Button>}
      >
        <CustomRange state={state} onChange={onChange} />
      </Modal>
      <span className="text-muted-foreground text-xs">
        {state.range.from} to {state.range.to}
      </span>
      <Button
        variant="outline"
        aria-pressed={state.compare}
        onClick={() => {
          onChange({ ...state, compare: !state.compare });
        }}
      >
        Compare
      </Button>
      {state.filters.map((filter) => (
        <Button
          key={filter.facet}
          variant="secondary"
          aria-label={`Remove ${filter.facet}: ${filter.value}`}
          onClick={() => {
            onChange({ ...state, filters: removeFacet(state.filters, filter.facet) });
          }}
        >
          {filter.facet} is {filter.value} ×
        </Button>
      ))}
      <div className="ml-auto flex gap-2">
        <Button variant="ghost" onClick={onShare}>
          Share
        </Button>
        <Button variant="ghost" onClick={onExport}>
          Export CSV
        </Button>
      </div>
    </div>
  );
}
function CustomRange({
  state,
  onChange,
}: {
  state: DashboardState;
  onChange: (state: DashboardState) => void;
}) {
  const [range, setRange] = useState(state.range);
  const [message, setMessage] = useState('');
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!validRange(range)) {
          setMessage('Choose valid dates with the end on or after the start.');
          return;
        }
        onChange({ ...state, range });
        setMessage('Date range applied.');
      }}
    >
      <label className="grid gap-1">
        From
        <Input
          type="date"
          required
          value={range.from}
          onChange={(event) => {
            setRange({ ...range, from: event.target.value });
          }}
        />
      </label>
      <label className="grid gap-1">
        To
        <Input
          type="date"
          required
          value={range.to}
          onChange={(event) => {
            setRange({ ...range, to: event.target.value });
          }}
        />
      </label>
      <Button type="submit">Apply date range</Button>
      <p role="status">{message}</p>
    </form>
  );
}
