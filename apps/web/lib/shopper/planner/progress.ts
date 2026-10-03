/** Local question progress stores no credentials and is checked again on restoration. */
import { z } from 'zod';
import { shopperAnswersSchema, PLANNER_LIMITS, type ShopperAnswers } from './contracts';

/** Draft persistence has a versioned shape and a stable request UUID for safe retries. */
export const progressSchema = z.object({
  request: z.string().uuid(),
  age: z.string().datetime().nullable(),
  question: z
    .number()
    .int()
    .min(0)
    .max(PLANNER_LIMITS.questionCount - 1),
  started: z.boolean(),
  answers: shopperAnswersSchema,
  session: z.string().uuid().nullable(),
});
/** Validated local progress; final sessions are held in the database. */
export type PlannerProgress = z.infer<typeof progressSchema>;
/** Returns prototype defaults in the market currency, with soundtrack explicitly unset. */
export function defaultAnswers(currency: string): ShopperAnswers {
  return {
    occasion: 'Bonfire Night',
    garden: 'medium',
    budget_minor: PLANNER_LIMITS.defaultBudget,
    currency,
    noise: 'normal',
    looks: ['Gold', 'Crackle'],
    length_min: PLANNER_LIMITS.defaultLength,
    soundtrack: null,
  };
}
/** Names local progress by store and scanned product so independent journeys cannot collide. */
export function progressKey(store: string, product?: string): string {
  return `shopper-planner:${store}:${product ?? 'store'}`;
}
/** Selects the highest requested persisted rank; all preceding candidates remain in history. */
export function currentCandidate<T extends { rank: number }>(candidates: readonly T[]): T {
  const sorted = [...candidates].sort((left, right) => right.rank - left.rank);
  const candidate = sorted.at(0);
  if (!candidate) throw new Error('Saved plan has no candidates');
  return candidate;
}
