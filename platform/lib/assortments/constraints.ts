export type ProductQuantityLedger = ReadonlyMap<string, number>;

export type ProductLedgerCue = {
  productId: string;
};

export type ProductQuantityMismatch = {
  productId: string;
  expected: number;
  actual: number;
};

export function productQuantityCapacity(ledger: ProductQuantityLedger | null): number | null {
  if (!ledger) return null;
  let total = 0;
  for (const quantity of ledger.values()) total += Math.max(0, Math.floor(quantity));
  return total;
}

export function exactProductQuantityMismatches<T extends ProductLedgerCue>(
  cues: readonly T[],
  ledger: ProductQuantityLedger | null,
): ProductQuantityMismatch[] {
  if (!ledger) return [];

  const usage = new Map<string, number>();
  for (const cue of cues) {
    usage.set(cue.productId, (usage.get(cue.productId) ?? 0) + 1);
  }

  const mismatches: ProductQuantityMismatch[] = [];
  for (const [productId, expected] of ledger) {
    const actual = usage.get(productId) ?? 0;
    if (actual !== expected) mismatches.push({ productId, expected, actual });
    usage.delete(productId);
  }
  for (const [productId, actual] of usage) {
    mismatches.push({ productId, expected: 0, actual });
  }
  return mismatches.sort((left, right) => left.productId.localeCompare(right.productId));
}

/**
 * A physical assortment is successful only when every purchased unit appears
 * exactly once. This validator never repairs or drops cues because doing so
 * would conceal an invalid show from the retry and credit lifecycle.
 */
export function requireExactProductQuantityLedger<T extends ProductLedgerCue>(
  cues: readonly T[],
  ledger: ProductQuantityLedger | null,
  plannerName: string,
): T[] {
  const mismatches = exactProductQuantityMismatches(cues, ledger);
  if (mismatches.length === 0) return [...cues];

  const detail = mismatches
    .map(
      ({ productId, expected, actual }) => `${productId}: expected ${expected}, received ${actual}`,
    )
    .join('; ');
  throw new Error(`${plannerName} did not consume the physical assortment exactly (${detail}).`);
}
