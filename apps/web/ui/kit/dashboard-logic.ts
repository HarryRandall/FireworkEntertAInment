/** Pure dashboard filters, UTC calendar comparisons and safe CSV serialisation. */
// UTC days avoid daylight-saving shifts when comparing inclusive date ranges.
import { z } from 'zod';
const DAY_MS = 86_400_000;
// ISO calendar date prefix length, in characters.
const ISO_DATE_LENGTH = 10;
const PERCENT = 100;
/** One selected value per facet, matching the prototype's replacement behaviour. */
export interface DashboardFilter {
  facet: string;
  value: string;
}
/** Inclusive UTC calendar dates, encoded as YYYY-MM-DD. */
export interface DateRange {
  from: string;
  to: string;
}
/** Serializable dashboard state with an optional same-date last-year comparison. */
export interface DashboardState {
  filters: DashboardFilter[];
  range: DateRange;
  compare: boolean;
}

/** Adds or replaces a facet without mutating the caller's filter list. */
export function setFacet(
  filters: readonly DashboardFilter[],
  next: DashboardFilter,
): DashboardFilter[] {
  return filters.filter((filter) => filter.facet !== next.facet).concat(next);
}
/** Removes a facet without changing other selected values. */
export function removeFacet(filters: readonly DashboardFilter[], facet: string): DashboardFilter[] {
  return filters.filter((filter) => filter.facet !== facet);
}
function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, ISO_DATE_LENGTH) === value
    ? date
    : null;
}
/** Checks real calendar dates and inclusive chronological order. */
export function validRange(range: DateRange): boolean {
  return parseDay(range.from) !== null && parseDay(range.to) !== null && range.from <= range.to;
}
/** Returns an inclusive range of days ending on a valid UTC date; days must be a positive integer. */
export function trailingRange(to: string, days: number): DateRange {
  const end = parseDay(to);
  if (end === null || !Number.isInteger(days) || days < 1)
    throw new RangeError('Invalid date range');
  return {
    from: new Date(end.getTime() - (days - 1) * DAY_MS).toISOString().slice(0, ISO_DATE_LENGTH),
    to,
  };
}
function previousYear(value: string): string {
  const date = parseDay(value);
  if (date === null) throw new RangeError('Invalid calendar date');
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  // Leap day rolls into March; clamp to February's final day instead.
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}
/** Compares the same calendar dates last season, clamping leap days to 28 February. */
export function compareRange(range: DateRange): DateRange {
  if (!validRange(range)) throw new RangeError('Invalid date range');
  return { from: previousYear(range.from), to: previousYear(range.to) };
}
function csvCell(value: string | number): string {
  const text = String(value);
  // Spreadsheet formula prefixes are escaped even after leading whitespace.
  const safe = /^\s*[=+@-]/.test(text) && typeof value === 'string' ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
/** Encodes rectangular rows as UTF-8-compatible CSV with CRLF and spreadsheet formula protection. */
export function exportCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  if (rows.some((row) => row.length !== headers.length))
    throw new RangeError('CSV row width differs from headers');
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
/** Encodes local view state in a URL; this grants no access or public sharing permission. */
export function dashboardLink(base: string, state: DashboardState): string {
  const url = new URL(base);
  url.searchParams.set('dashboard', JSON.stringify(state));
  return url.toString();
}
/** Decodes untrusted view state only when its dates and facets match the consumer's allowlist. */
export function readDashboardState(
  value: string | null,
  facets: Record<string, readonly string[]>,
): DashboardState | null {
  if (value === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  const result = stateSchema.safeParse(parsed);
  if (!result.success || !validRange(result.data.range)) return null;
  const filters: DashboardFilter[] = [];
  for (const item of result.data.filters) {
    if (!validFacet(item, facets) || filters.some((filter) => filter.facet === item.facet))
      return null;
    filters.push(item);
  }
  return { ...result.data, filters };
}

const stateSchema = z
  .object({
    filters: z.array(z.object({ facet: z.string(), value: z.string() }).strict()),
    range: z.object({ from: z.string(), to: z.string() }).strict(),
    compare: z.boolean(),
  })
  .strict();
function validFacet(value: DashboardFilter, facets: Record<string, readonly string[]>): boolean {
  return Object.hasOwn(facets, value.facet) && facets[value.facet].includes(value.value);
}
/** Returns the percentage of the first funnel step, with an empty funnel yielding zero. */
export function funnelPercent(value: number, first: number): number {
  return first <= 0 ? 0 : Math.round((value / first) * PERCENT);
}
