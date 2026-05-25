/**
 * Supplier metadata fixture for the Hammer & Anvil seed.
 *
 * Upserted (`onConflict: 'slug'`) before any catalogue / inventory writes so
 * the supplier profile id is available to link inventory rows.
 */

export const SUPPLIER = {
  name: 'Hammer & Anvil',
  slug: 'hammer-and-anvil',
  status: 'active' as const,
};
