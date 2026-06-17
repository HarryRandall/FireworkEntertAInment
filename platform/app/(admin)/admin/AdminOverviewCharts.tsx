'use client';

import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

export type AdminOverviewActivityDatum = {
  dayIndex: number;
  label: string;
  shows: number;
  analyses: number;
  cues: number;
};

export type AdminOverviewPulseDatum = {
  dayIndex: number;
  label: string;
  cues: number;
};

export type AdminOverviewStatusDatum = {
  label: string;
  value: number;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
};

export type AdminOverviewBarDatum = {
  source: string;
  label: string;
  value: number;
};

const activityChartConfig = {
  shows: {
    color: 'var(--chart-3)',
    label: 'Shows',
  },
  analyses: {
    color: 'var(--muted-foreground)',
    label: 'Analyses',
  },
} satisfies ChartConfig;

const pulseNumberFormatter = new Intl.NumberFormat('en-AU');

function safeCatalogueRows(data: AdminOverviewBarDatum[]): AdminOverviewBarDatum[] {
  if (data.length > 0) return data;
  return [{ source: 'No data', label: '0', value: 0 }];
}

function catalogueLineWidth(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) return '0%';
  return `${Math.max((value / maxValue) * 100, 6)}%`;
}

function toneDotClass(tone: AdminOverviewStatusDatum['tone']) {
  if (tone === 'success') return 'bg-green-500';
  if (tone === 'warning') return 'bg-amber-500';
  if (tone === 'danger') return 'bg-destructive';
  return 'bg-muted-foreground';
}

function CatalogueRankingList({
  data,
  limit = 5,
}: {
  data: AdminOverviewBarDatum[];
  limit?: number;
}) {
  const rows = safeCatalogueRows(data);
  const visibleRows = rows.slice(0, limit);
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-3">
      {visibleRows.map((row) => (
        <div key={row.source} className="space-y-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{row.source}</span>
            <span className="text-muted-foreground text-right tabular-nums">{row.label}</span>
          </div>
          <div className="bg-muted/50 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-muted-foreground/45 h-full rounded-full"
              style={{ width: catalogueLineWidth(row.value, maxValue) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function GenerationPulseBars({ data }: { data: AdminOverviewPulseDatum[] }) {
  const maxCues = Math.max(...data.map((datum) => datum.cues), 1);

  return (
    <div
      aria-label="Cue generation by period"
      className="flex h-36 w-full items-end gap-1"
      role="list"
    >
      {data.map((datum) => {
        const height = datum.cues > 0 ? Math.max((datum.cues / maxCues) * 100, 10) : 0;

        return (
          <div
            aria-label={`${datum.label}: ${pulseNumberFormatter.format(datum.cues)} cues`}
            className="group flex h-full min-w-0 flex-1 items-end"
            key={`${datum.dayIndex}-${datum.label}`}
            role="listitem"
            title={`${datum.label}: ${pulseNumberFormatter.format(datum.cues)} cues`}
          >
            <div
              className={cn(
                'w-full rounded-sm transition-colors',
                datum.cues > 0 ? 'bg-primary/75 group-hover:bg-primary' : 'bg-muted-foreground/35',
              )}
              style={{ height: datum.cues > 0 ? `${height}%` : '2px' }}
            />
          </div>
        );
      })}
    </div>
  );
}

function CatalogueMixSection({ data, title }: { data: AdminOverviewBarDatum[]; title: string }) {
  return (
    <section className="min-w-0 space-y-3">
      <h3 className="text-muted-foreground text-sm font-normal">{title}</h3>
      <CatalogueRankingList data={data} />
    </section>
  );
}

function buildActivityTicks(dataLength: number) {
  if (dataLength <= 1) return [1];

  const maxTickCount = 5;
  const step = Math.max(1, Math.ceil((dataLength - 1) / (maxTickCount - 1)));
  const ticks: number[] = [];

  for (let value = 1; value <= dataLength; value += step) {
    ticks.push(value);
  }

  if (ticks[ticks.length - 1] !== dataLength) ticks.push(dataLength);
  return ticks;
}

function formatActivityTick(value: number | string, data: AdminOverviewActivityDatum[]) {
  const dayIndex = Number(value);
  if (!Number.isFinite(dayIndex)) return '';
  return data[dayIndex - 1]?.label ?? '';
}

export function ShowActivityChart({ data }: { data: AdminOverviewActivityDatum[] }) {
  const ticks = buildActivityTicks(data.length);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Show activity</CardTitle>
      </CardHeader>

      <CardContent>
        <ChartContainer config={activityChartConfig} className="h-72 w-full">
          <ComposedChart data={data} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="dayIndex"
              axisLine={false}
              domain={[1, Math.max(data.length, 1)]}
              interval={0}
              tickFormatter={(value) => formatActivityTick(value, data)}
              tickLine={false}
              tickMargin={14}
              ticks={ticks}
              type="number"
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              domain={[0, 'dataMax + 1']}
              tickLine={false}
              tickMargin={10}
              width={34}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="w-44"
                  labelFormatter={(_, payload) => payload[0]?.payload?.label ?? 'Activity'}
                />
              }
            />
            <Line
              dataKey="analyses"
              dot={false}
              stroke="var(--color-analyses)"
              strokeDasharray="4 4"
              strokeOpacity={0.68}
              strokeWidth={1.75}
              type="linear"
            />
            <Line
              dataKey="shows"
              activeDot={{ r: 4 }}
              dot={false}
              stroke="var(--color-shows)"
              strokeWidth={2.5}
              type="linear"
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function GenerationPulseCard({
  data,
  statuses,
  summaryLabel,
  summaryValue,
}: {
  data: AdminOverviewPulseDatum[];
  statuses: AdminOverviewStatusDatum[];
  summaryLabel: string;
  summaryValue: number;
}) {
  const live = statuses.some((status) => status.label === 'Running' && status.value > 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Generation pulse</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5">
            <span className="shrink-0 text-2xl leading-none tracking-tight tabular-nums">
              {summaryValue.toLocaleString()}
            </span>
            <span className="text-muted-foreground min-w-0 text-sm leading-tight">
              {summaryLabel}
            </span>
          </div>
          <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-sm">
            <span className="relative flex size-2">
              {live ? (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
              ) : null}
              <span
                className={cn(
                  'relative inline-flex size-2 rounded-full',
                  live ? 'bg-green-500' : 'bg-muted-foreground',
                )}
              />
            </span>
            <span>{live ? 'Live' : 'Idle'}</span>
          </div>
        </div>

        <GenerationPulseBars data={data} />

        <div className="border-border/50 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-x-5 border-t pt-2">
          {statuses.map((status) => (
            <div key={status.label} className="flex min-w-0 items-center gap-3 py-2">
              <span className={cn('size-2 shrink-0 rounded-full', toneDotClass(status.tone))} />
              <span className="min-w-0 flex-1 truncate text-sm">{status.label}</span>
              <span className="text-sm tabular-nums">{status.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CatalogueMixChart({
  fireworkTypes,
  importStatuses,
  manufacturers,
  variant = 'full',
}: {
  fireworkTypes: AdminOverviewBarDatum[];
  importStatuses: AdminOverviewBarDatum[];
  manufacturers: AdminOverviewBarDatum[];
  variant?: 'compact' | 'full';
}) {
  if (variant === 'compact') {
    return (
      <Card className="gap-2">
        <CardHeader>
          <CardTitle className="font-normal">Top catalogue types</CardTitle>
        </CardHeader>

        <CardContent>
          <CatalogueRankingList data={fireworkTypes} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Catalogue mix</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-6 md:grid-cols-3">
        <CatalogueMixSection data={fireworkTypes} title="Types" />
        <CatalogueMixSection data={manufacturers} title="Makers" />
        <CatalogueMixSection data={importStatuses} title="Imports" />
      </CardContent>
    </Card>
  );
}
