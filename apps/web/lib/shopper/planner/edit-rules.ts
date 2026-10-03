/** Exact supported phrases map to deterministic operations without a model or fuzzy guessing. */
import type { PlannerInput } from '@showcrafter/planner';
import { EDIT_CHIPS, type EditOp, type EditRequest } from './edit-contracts';

// Product choices: reduce the current total by 20%; add one minute, within the question's ten-minute ceiling.
const CHEAPER_TOTAL_RATIO = 0.8;
const EXTRA_LENGTH_MINUTES = 1;
const MAX_LENGTH_MINUTES = 10;
// All launch markets use hundredths of their currency for the shopper budget controls.
const MINOR_PER_MAJOR = 100;
// Regex capture positions: prefix currency, amount, suffix currency.
const SUFFIX_CURRENCY_CAPTURE = 3;
const CURRENCY_MARKERS: Partial<Record<string, string[]>> = {
  GBP: ['£', 'gbp'],
  USD: ['$', 'usd'],
  EUR: ['€', 'eur'],
  AUD: ['$', 'aud'],
};
const PHRASES: Partial<Record<string, string>> = {
  longer: 'Longer',
  'make it longer': 'Longer',
  cheaper: 'Cheaper',
  'make it cheaper': 'Cheaper',
  'more crackle': 'More crackle',
  'add more crackle': 'More crackle',
  'bigger finale': 'Bigger finale',
  'make the finale bigger': 'Bigger finale',
  quieter: 'Quieter',
  'make it quieter': 'Quieter',
  'pet friendly': 'Quieter',
};
/** Parses a request using the current total in minor currency units; returns ops without mutation, or no ops for an unknown phrase. */
export function matchEdit(
  request: Pick<EditRequest, 'source' | 'message' | 'product'>,
  input: PlannerInput,
  total: number,
): EditOp[] {
  if (request.source === 'chip') {
    if (!EDIT_CHIPS.some((chip) => chip === request.message)) return [];
    return chipOps(request.message, input, total, request.product);
  }
  const phrase = request.message.toLowerCase().trim().replace(/[.!]$/, '').replace(/\s+/g, ' ');
  if (phrase === 'pet friendly') return [{ op: 'set_noise', noise: 'quiet' }];
  const matched = Object.hasOwn(PHRASES, phrase) ? PHRASES[phrase] : undefined;
  if (matched !== undefined) return chipOps(matched, input, total);
  const budget =
    /^(?:under|keep it under|budget)\s*(£|\$|€|gbp|usd|eur|aud)?\s*(\d+(?:\.\d{1,2})?)\s*(gbp|usd|eur|aud)?$/.exec(
      phrase,
    );
  if (!budget) return [];
  const markers = [budget.at(1), budget.at(SUFFIX_CURRENCY_CAPTURE)].filter(
    (marker): marker is string => marker !== undefined,
  );
  if (markers.some((marker) => CURRENCY_MARKERS[input.answers.currency]?.includes(marker) !== true))
    return [];
  const amount = Math.round(Number(budget[2]) * MINOR_PER_MAJOR);
  return Number.isSafeInteger(amount)
    ? [{ op: 'set_budget', max_minor: Math.min(amount, input.answers.budget_minor) }]
    : [];
}
function chipOps(chip: string, input: PlannerInput, total: number, product?: string): EditOp[] {
  switch (chip) {
    case 'Longer':
      return [
        {
          op: 'set_length',
          length_min: Math.min(MAX_LENGTH_MINUTES, input.answers.length_min + EXTRA_LENGTH_MINUTES),
        },
      ];
    case 'Cheaper':
      return [{ op: 'set_budget', max_minor: Math.floor(total * CHEAPER_TOTAL_RATIO) }];
    case 'More crackle':
      return [{ op: 'more', attribute: 'crackle' }];
    case 'Bigger finale':
      return [{ op: 'more', attribute: 'finale' }];
    case 'Quieter':
      return [{ op: 'set_noise', noise: input.answers.noise === 'loud' ? 'normal' : 'quiet' }];
    case 'Swap this firework':
      return product !== undefined ? [{ op: 'swap_product', product_id: product }] : [];
    default:
      return [];
  }
}
