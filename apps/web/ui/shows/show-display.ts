/** Shared display formatting for show tables and summary panels. */
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format stored cents consistently, including thousands separators. */
export function formatShowCurrency(cents: number | null | undefined): string {
  return cents == null || !Number.isFinite(cents) ? 'Price TBC' : currency.format(cents / 100);
}

/** Keep zero-time cues visible and avoid rounding a second into an invalid minute. */
export function formatCueTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '-';
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}
