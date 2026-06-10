'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts';
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

const weeklyTicks = [4, 11, 18, 25];

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

const pulseChartConfig = {
  cues: {
    color: 'var(--chart-1)',
    label: 'Cues',
  },
} satisfies ChartConfig;

function formatWeek(value: number) {
  const weekIndex = weeklyTicks.indexOf(value);
  return weekIndex >= 0 ? `Week ${weekIndex + 1}` : '';
}

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

function GenerationPulseBarShape(props: BarShapeProps) {
  const { height, payload, width, x, y } = props;
  const barPayload = payload as AdminOverviewPulseDatum | undefined;
  const barHeightValue = Number(height);
  const barWidthValue = Number(width);
  const xValue = Number(x);
  const yValue = Number(y);
  const cues = barPayload?.cues ?? 0;
  const fill = 'var(--color-cues)';
  const fillOpacity = cues > 0 ? Math.min(0.95, 0.35 + cues / 40) : 0.25;
  const baselineFill = cues === 0 ? 'var(--muted-foreground)' : fill;
  const baselineOpacity = cues === 0 ? 0.6 : fillOpacity;
  const baselineY = yValue + barHeightValue - 2;
  const barGap = 4;
  const barHeight = Math.max(0, barHeightValue - barGap);

  return (
    <g>
      <rect
        x={xValue}
        y={baselineY}
        width={barWidthValue}
        height={2}
        rx={1}
        fill={baselineFill}
        fillOpacity={baselineOpacity}
      />
      {cues > 0 && barHeight > 0 ? (
        <rect
          x={xValue}
          y={yValue}
          width={barWidthValue}
          height={barHeight}
          rx={2}
          fill={fill}
          fillOpacity={fillOpacity}
        />
      ) : null}
    </g>
  );
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

function CatalogueMixSection({ data, title }: { data: AdminOverviewBarDatum[]; title: string }) {
  return (
    <section className="min-w-0 space-y-3">
      <h3 className="text-muted-foreground text-sm font-normal">{title}</h3>
      <CatalogueRankingList data={data} />
    </section>
  );
}

export function ShowActivityChart({ data }: { data: AdminOverviewActivityDatum[] }) {
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
              domain={[1, 28]}
              interval={0}
              tickFormatter={formatWeek}
              tickLine={false}
              tickMargin={14}
              ticks={weeklyTicks}
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
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl leading-none tracking-tight tabular-nums">
              {summaryValue.toLocaleString()}
            </span>
            <span className="text-muted-foreground text-sm">{summaryLabel}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
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

        <ChartContainer config={pulseChartConfig} className="h-36 w-full">
          <BarChart
            data={data}
            margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
            barCategoryGap={3}
          >
            <XAxis dataKey="dayIndex" hide />
            <YAxis hide allowDecimals={false} domain={[0, 'dataMax + 1']} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel={false}
                  labelFormatter={(_, payload) => payload[0]?.payload?.label ?? 'Cues'}
                />
              }
            />
            <Bar dataKey="cues" fill="var(--color-cues)" shape={GenerationPulseBarShape} />
          </BarChart>
        </ChartContainer>

        <div className="grid grid-cols-2">
          {statuses.map((status, index) => (
            <div
              key={status.label}
              className={cn(
                'border-border/50 flex items-center gap-3 py-3',
                index % 2 === 0 ? 'border-r pr-5' : 'pl-5',
                index < 2 ? 'border-b' : '',
              )}
            >
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
