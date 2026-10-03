/** Stable shopper destinations and market-aware display values. */
const MINOR_UNITS_PER_MAJOR = 100; // The enabled market currencies all use hundredths.
/** Returns a safe local store route from a public slug. */
export function storePath(slug: string): string {
  return `/shopper/stores/${encodeURIComponent(slug)}`;
}
/** Returns the local destination for a validated public QR target. */
export function qrDestination(slug: string, type: string, id: string | null): string {
  const base = storePath(slug);
  switch (type) {
    case 'product':
    case 'pack':
      if (id === null) throw new Error('Product target is missing');
      return `${base}/products/${encodeURIComponent(id)}`;
    case 'show':
      if (id === null) throw new Error('Show target is missing');
      return `${base}/shows/${encodeURIComponent(id)}`;
    case 'collection':
      if (id === null) throw new Error('Collection target is missing');
      return `${base}?collection=${encodeURIComponent(id)}#collections`;
    case 'planner':
      return `${base}/plan`;
    case 'store':
      return base;
    default:
      throw new Error('Unknown QR target');
  }
}
/** Formats integer minor units in the store's currency without changing its value. */
export function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
    minor / MINOR_UNITS_PER_MAJOR,
  );
}
/** Preserves the resolved scan identity at the destination's client event boundary. */
export function scannedDestination(
  slug: string,
  type: string,
  id: string | null,
  qr: string,
): string {
  const destination = new URL(qrDestination(slug, type, id), 'https://showcrafter.invalid');
  destination.searchParams.set('qr', qr);
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
