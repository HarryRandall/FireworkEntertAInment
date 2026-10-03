// Fail closed on missing safety facts and use current stock without reserving it.
import type { PlannerInput, PlannerProduct } from './input.ts';

// Ordinal ceilings: quiet excludes bangs/crackle/whistle; normal permits catalogue level 2.
const LOUD_NOISE_LEVEL = 3;
const NOISE_LIMITS = { quiet: 1, normal: 2, loud: LOUD_NOISE_LEVEL };

/** Returns the request-level refusal, or null; sale and age facts must come from the trusted caller. */
export function eligibilityFailure(input: PlannerInput): string | null {
  if (!input.market.enabled || input.market.currency !== input.answers.currency) {
    return 'Market unavailable or currency mismatch';
  }
  if (!input.sale.open) {
    return 'Sales are closed for this store';
  }
  if (
    input.age_confirmation === null ||
    input.age_confirmation.minimum_age < input.market.min_age
  ) {
    return 'Age confirmation is required for the market minimum age';
  }
  if (
    input.safety_band.market !== input.market.code ||
    input.safety_band.band !== input.answers.garden
  ) {
    return 'Safety band does not match the market and garden';
  }
  return null;
}

/** Returns safe, eligible published units priced in minor units, without changing stock or the input. */
export function eligibleProducts(input: PlannerInput): PlannerProduct[] {
  return input.products.filter(
    (product) => storeEligible(product, input) && safetyEligible(product, input),
  );
}

function storeEligible(product: PlannerProduct, input: PlannerInput): boolean {
  return (
    product.store_id === input.store_id &&
    product.status === 'published' &&
    !product.hidden &&
    product.stock_qty > 0 &&
    product.currency === input.answers.currency &&
    product.price_minor <= input.answers.budget_minor &&
    marketEligible(product, input)
  );
}

function marketEligible(product: PlannerProduct, input: PlannerInput): boolean {
  const market = product.product_market;
  const age = Math.max(input.market.min_age, market.min_age ?? input.market.min_age);
  return (
    market.market === input.market.code &&
    market.allowed &&
    market.confirmed &&
    (input.age_confirmation?.minimum_age ?? 0) >= age
  );
}

function safetyEligible(product: PlannerProduct, input: PlannerInput): boolean {
  if (
    !product.safety_confirmed ||
    product.min_safety_distance_m === null ||
    product.noise_level === null
  ) {
    return false;
  }
  const quiet = input.answers.noise === 'quiet';
  return (
    product.min_safety_distance_m <= input.safety_band.max_distance_m &&
    input.safety_band.allowed_categories.includes(product.product_market.legal_category) &&
    product.noise_level <= NOISE_LIMITS[input.answers.noise] &&
    !(quiet && (product.has_bangs || product.has_crackle || product.has_whistle))
  );
}
