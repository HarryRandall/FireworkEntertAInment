/** Exact quantity-aware totals from immutable list prices, never current shop prices. */
import type { ShopperList } from './contracts';
/** Returns integer minor units and their currency, or null for an empty list; rejects mixed currencies and unsafe integer totals. */
export function listTotal(items: ShopperList['items']) {
  const first = items.at(0);
  if (first === undefined) return null;
  const minor = items.reduce((sum, item) => {
    if (item.currency !== first.currency) throw new Error('List currencies do not match');
    return sum + item.quantity * item.unit_price_minor;
  }, 0);
  if (!Number.isSafeInteger(minor)) throw new Error('List total exceeds safe integer precision');
  return { minor, currency: first.currency };
}
