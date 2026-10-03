// Synthetic store snapshots; identifiers and safety confirmation are test data only.
export const uuid = (index) => `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
export const storeId = uuid(900);
export function product(index, overrides = {}) {
  return {
    product_id: uuid(index),
    store_id: storeId,
    current_version_id: uuid(index + 1000),
    status: 'published',
    kind: 'cake',
    price_minor: 2000,
    currency: 'GBP',
    stock_qty: 3,
    hidden: false,
    min_safety_distance_m: 8,
    noise_level: 1,
    safety_confirmed: true,
    has_bangs: false,
    has_crackle: false,
    has_whistle: false,
    duration_ms: 30000,
    impact_delay_ms: 1500,
    energy: 0.5,
    colours: ['gold'],
    tags: ['willow'],
    product_market: {
      market: 'GB',
      allowed: true,
      legal_category: 'F2',
      min_age: 18,
      confirmed: true,
    },
    ...overrides,
  };
}
export function input(products = [product(1), product(2, { energy: 0.8 })]) {
  return {
    answers: {
      occasion: 'Bonfire Night',
      garden: 'medium',
      budget_minor: 15000,
      currency: 'GBP',
      noise: 'normal',
      looks: ['Gold', 'Willow'],
      length_min: 4,
      soundtrack: null,
    },
    store_id: storeId,
    market: { code: 'GB', currency: 'GBP', min_age: 18, enabled: true },
    sale: { open: true, evaluated_at: '2026-11-05T12:00:00Z' },
    age_confirmation: { confirmed_at: '2026-11-05T11:59:00Z', minimum_age: 18 },
    safety_band: { market: 'GB', band: 'medium', max_distance_m: 15, allowed_categories: ['F2'] },
    products,
    music: null,
  };
}
