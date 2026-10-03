// Normalised objective terms rank feasible plans without weakening budget or safety constraints.
import type { PlannerInput, PlannerProduct } from './input.ts';
import type { PlanMood, PlanScores, SolverWeights } from './types.ts';
import { pacingScore } from './pacing.ts';

// Three distinct colours count as the prototype's 'Lots of colour' preference.
const COLOUR_VARIETY_THRESHOLD = 3;
// Product judgement: four distinct units provide a varied small garden show; repeats do not erase that coverage.
const VARIETY_TARGET = 4;
const LOOK_TAGS: Record<string, string[]> = {
  shapes: ['heart', 'ring', 'shape', 'shapes'],
  comets: ['comet', 'comets', 'tail', 'tails'],
  rockets: ['rocket', 'rocket_pack', 'rockets'],
};

/** Fraction of requested looks matched by one unit, using case-insensitive catalogue colours and tags. */
export function lookMatch(product: PlannerProduct, looks: string[]): number {
  if (looks.length === 0) {
    return 1;
  }
  const facts = new Set(
    [...product.colours, ...product.tags, product.kind].map((fact) => fact.toLowerCase()),
  );
  const requested = [...new Set(looks.map((look) => look.toLowerCase()))];
  const matches = requested.filter((look) => {
    const key = look.toLowerCase();
    if (key === 'colour') {
      return (
        new Set(product.colours.map((colour) => colour.toLowerCase())).size >=
        COLOUR_VARIETY_THRESHOLD
      );
    }
    if (key === 'crackle') {
      return product.has_crackle;
    }
    return (LOOK_TAGS[key] ?? [key]).some((tag) => facts.has(tag));
  });
  return matches.length / requested.length;
}

/** Scores a non-empty feasible assortment, given its visible duration in milliseconds and minor-unit total. */
export function scorePlan(
  products: PlannerProduct[],
  context: {
    input: PlannerInput;
    mood: PlanMood;
    duration: number;
    total: number;
  },
): PlanScores {
  const { input, mood, duration, total } = context;
  return {
    variety: Math.min(
      new Set(products.map((product) => product.product_id)).size / VARIETY_TARGET,
      1,
    ),
    pacing: pacingScore(products, duration, input, mood),
    budget_use: input.answers.budget_minor === 0 ? 1 : total / input.answers.budget_minor,
    look_match:
      products.reduce((sum, product) => sum + lookMatch(product, input.answers.looks), 0) /
      products.length,
  };
}

/** Weighted mean of bounded score terms; weights must be non-negative with a positive finite sum. */
export function weightedScore(scores: PlanScores, weights: SolverWeights): number {
  const total = weights.variety + weights.pacing + weights.budget_use + weights.look_match;
  return (
    (scores.variety * weights.variety +
      scores.pacing * weights.pacing +
      scores.budget_use * weights.budget_use +
      scores.look_match * weights.look_match) /
    total
  );
}
