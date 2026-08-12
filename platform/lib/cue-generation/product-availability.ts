export type ExactProductQuantities = ReadonlyMap<string, number>;

/**
 * Future-compatible exact-quantity ledger for fixed-assortment planning. The
 * production runner has no legitimate quantity source today and therefore
 * omits this map, preserving the current unlimited catalogue behaviour.
 */
export class ProductAvailability {
  private readonly used = new Map<string, number>();
  private readonly exactQuantities?: ExactProductQuantities;

  constructor(exactQuantities?: ExactProductQuantities) {
    this.exactQuantities = exactQuantities;
  }

  canUse(productId: string): boolean {
    if (!this.exactQuantities) return true;
    const limit = this.exactQuantities.get(productId);
    if (limit == null) return false;
    return (this.used.get(productId) ?? 0) < Math.max(0, Math.floor(limit));
  }

  recordUse(productId: string): void {
    if (!this.canUse(productId)) {
      throw new RangeError(`No remaining quantity for product ${productId}.`);
    }
    this.used.set(productId, (this.used.get(productId) ?? 0) + 1);
  }

  usedCount(productId: string): number {
    return this.used.get(productId) ?? 0;
  }
}
