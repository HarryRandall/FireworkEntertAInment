const DAY_MS = 24 * 60 * 60 * 1000;

export const ADMIN_OVERVIEW_RANGE_PARAM = 'range';

export const ADMIN_OVERVIEW_RANGE_OPTIONS = [
  {
    days: 7,
    key: 'last-7-days',
    kind: 'days',
    label: 'Last 7 days',
    metricLabel: 'last 7 days',
    previousLabel: 'previous 7 days',
  },
  {
    days: 28,
    key: 'last-4-weeks',
    kind: 'days',
    label: 'Last 4 weeks',
    metricLabel: 'last 4 weeks',
    previousLabel: 'previous 4 weeks',
  },
  {
    key: 'last-3-months',
    kind: 'months',
    label: 'Last 3 months',
    metricLabel: 'last 3 months',
    months: 3,
    previousLabel: 'previous 3 months',
  },
  {
    key: 'year-to-date',
    kind: 'year-to-date',
    label: 'Year to date',
    metricLabel: 'year to date',
    previousLabel: 'previous matching period',
  },
] as const;

export type AdminOverviewRangeOption = (typeof ADMIN_OVERVIEW_RANGE_OPTIONS)[number];
export type AdminOverviewRangeKey = AdminOverviewRangeOption['key'];

export const DEFAULT_ADMIN_OVERVIEW_RANGE_KEY: AdminOverviewRangeKey = 'last-4-weeks';

export type AdminOverviewRangeWindow = {
  chartDays: number;
  end: Date;
  endIso: string;
  previousEnd: Date;
  previousEndIso: string;
  previousStart: Date;
  previousStartIso: string;
  range: AdminOverviewRangeOption;
  start: Date;
  startIso: string;
};

const rangeOptionsByKey = new Map<AdminOverviewRangeKey, AdminOverviewRangeOption>(
  ADMIN_OVERVIEW_RANGE_OPTIONS.map((option) => [option.key, option]),
);

export function getAdminOverviewRangeOption(
  key: string | null | undefined,
): AdminOverviewRangeOption {
  return (
    rangeOptionsByKey.get(key as AdminOverviewRangeKey) ??
    rangeOptionsByKey.get(DEFAULT_ADMIN_OVERVIEW_RANGE_KEY)!
  );
}

export function parseAdminOverviewRange(
  value: string | string[] | null | undefined,
): AdminOverviewRangeOption {
  return getAdminOverviewRangeOption(Array.isArray(value) ? value[0] : value);
}

export function getAdminOverviewRangeWindow(
  key: AdminOverviewRangeKey,
  now = new Date(),
): AdminOverviewRangeWindow {
  const range = getAdminOverviewRangeOption(key);
  const end = new Date(now.getTime());
  const todayStart = startOfUtcDay(now);
  let start: Date;
  let previousStart: Date;

  switch (range.kind) {
    case 'days':
      start = subtractUtcDays(todayStart, range.days - 1);
      previousStart = subtractUtcDays(start, range.days);
      break;
    case 'months':
      start = startOfUtcDay(subtractUtcMonths(todayStart, range.months));
      previousStart = startOfUtcDay(subtractUtcMonths(start, range.months));
      break;
    case 'year-to-date':
      start = new Date(Date.UTC(todayStart.getUTCFullYear(), 0, 1));
      previousStart = subtractUtcDays(start, inclusiveUtcDayCount(start, end));
      break;
    default:
      start = subtractUtcDays(todayStart, 27);
      previousStart = subtractUtcDays(start, 28);
  }

  const previousEnd = start;

  return {
    chartDays: inclusiveUtcDayCount(start, end),
    end,
    endIso: end.toISOString(),
    previousEnd,
    previousEndIso: previousEnd.toISOString(),
    previousStart,
    previousStartIso: previousStart.toISOString(),
    range,
    start,
    startIso: start.toISOString(),
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function subtractUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * DAY_MS);
}

function subtractUtcMonths(date: Date, months: number): Date {
  const target = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() - months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const day = Math.min(date.getUTCDate(), daysInUtcMonth(target));
  target.setUTCDate(day);
  return target;
}

function daysInUtcMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function inclusiveUtcDayCount(start: Date, end: Date): number {
  const startDay = startOfUtcDay(start);
  const endDay = startOfUtcDay(end);
  return Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / DAY_MS) + 1);
}
