// Bounded beam search explores whole-unit assortments; every expansion preserves price and stock limits.
import type { PlannerInput, PlannerProduct } from './input.ts';
import type { PlanCandidate, PlanMood, SolverWeights } from './types.ts';
import {
  BEAM_WIDTH,
  FALLBACK_COUNT,
  MAX_PLAN_UNITS,
  MAX_SHOW_DURATION_MS,
  MS_PER_SECOND,
  RETAINED_PER_DEPTH,
  SHORTLIST_SIZE,
} from './config.ts';
import { compareText } from './hash.ts';
import { arrangeProducts, displayAdvance, targetDuration, targetEnergy } from './pacing.ts';
import { lookMatch, scorePlan, weightedScore } from './scoring.ts';
import { musicAnchors, scheduleProducts, type Anchor } from './schedule.ts';

type State = {
  products: PlannerProduct[];
  total: number;
  duration: number;
  score: number;
  key: string;
};

/** Searches safe units with a fixed work budget; results are heuristic rankings rather than an optimality guarantee. */
export function searchMood(
  products: PlannerProduct[],
  input: PlannerInput,
  mood: PlanMood,
  weights: SolverWeights,
): PlanCandidate[] {
  const shortlist = shortlistProducts(products, input, mood);
  let beam: State[] = [{ products: [], total: 0, duration: 0, score: 0, key: '' }];
  const retained: State[] = [];
  for (let depth = 0; depth < MAX_PLAN_UNITS; depth += 1) {
    const expanded = expandBeam(beam, shortlist, { input, mood, weights });
    expanded.sort(compareStates);
    beam = uniqueStates(expanded).slice(0, BEAM_WIDTH);
    retained.push(...beam.slice(0, RETAINED_PER_DEPTH));
    if (beam.length === 0) {
      break;
    }
  }
  const anchors = musicAnchors(input);
  return uniqueStates(retained.sort(compareStates))
    .map((state) => candidateFromState(state, { input, mood, weights, anchors }))
    .filter(
      (candidate) =>
        candidate.duration_ms <= MAX_SHOW_DURATION_MS &&
        candidate.duration_ms <= (input.music?.duration_seconds ?? Infinity) * MS_PER_SECOND,
    );
}

function shortlistProducts(
  products: PlannerProduct[],
  input: PlannerInput,
  mood: PlanMood,
): PlannerProduct[] {
  const priority = (product: PlannerProduct): number =>
    lookMatch(product, input.answers.looks) +
    1 -
    Math.abs(product.energy - targetEnergy(input, mood, 1));
  const ranked = [...products].sort((a, b) =>
    priority(b) - priority(a) !== 0
      ? priority(b) - priority(a)
      : compareText(a.product_id, b.product_id),
  );
  const cheapest = [...products].sort((a, b) =>
    a.price_minor !== b.price_minor
      ? a.price_minor - b.price_minor
      : compareText(a.product_id, b.product_id),
  );
  const longest = [...products].sort((a, b) =>
    a.duration_ms !== b.duration_ms
      ? b.duration_ms - a.duration_ms
      : compareText(a.product_id, b.product_id),
  );
  return [
    ...new Map(
      [
        ...ranked.slice(0, SHORTLIST_SIZE),
        ...cheapest.slice(0, FALLBACK_COUNT),
        ...longest.slice(0, FALLBACK_COUNT),
      ].map((product) => [product.product_id, product]),
    ).values(),
  ];
}

function expandBeam(
  beam: State[],
  products: PlannerProduct[],
  context: {
    input: PlannerInput;
    mood: PlanMood;
    weights: SolverWeights;
  },
): State[] {
  const expanded: State[] = [];
  for (const state of beam) {
    for (const product of products) {
      const next = expandState(state, product, context);
      if (next !== null) {
        expanded.push(next);
      }
    }
  }
  return expanded;
}

function expandState(
  state: State,
  product: PlannerProduct,
  context: {
    input: PlannerInput;
    mood: PlanMood;
    weights: SolverWeights;
  },
): State | null {
  const total = state.total + product.price_minor;
  const used = state.products.filter((item) => item.product_id === product.product_id).length;
  if (total > context.input.answers.budget_minor || used >= product.stock_qty) {
    return null;
  }
  const products = [...state.products, product].sort((a, b) =>
    a.energy !== b.energy ? a.energy - b.energy : compareText(a.product_id, b.product_id),
  );
  const arranged = arrangeProducts(products, context.input, context.mood);
  const duration = nominalDuration(arranged, context.mood);
  // Avoid padding a requested show with excess stock; one indivisible long unit is still a feasible plan.
  if (state.products.length > 0 && duration > targetDuration(context.input)) {
    return null;
  }
  const scores = scorePlan(arranged, { ...context, duration, total });
  const key = products.map((item) => item.product_id).join(',');
  return { products, total, duration, score: weightedScore(scores, context.weights), key };
}

function nominalDuration(products: PlannerProduct[], mood: PlanMood): number {
  let launch = 0;
  let end = 0;
  for (const product of products) {
    end = Math.max(end, launch + product.duration_ms);
    launch += displayAdvance(product, mood);
  }
  return end;
}

function candidateFromState(
  state: State,
  context: {
    input: PlannerInput;
    mood: PlanMood;
    weights: SolverWeights;
    anchors: Anchor[];
  },
): PlanCandidate {
  const { input, mood, weights, anchors } = context;
  const arranged = arrangeProducts(state.products, input, mood);
  const schedule = scheduleProducts(arranged, mood, anchors);
  const scores = scorePlan(arranged, {
    input,
    mood,
    duration: schedule.duration_ms,
    total: state.total,
  });
  const headline = arranged.at(-1);
  if (headline === undefined) {
    throw new Error('Search retained an empty assortment');
  }
  return {
    rank: 0,
    mood,
    headline_product_id: headline.product_id,
    ...schedule,
    total_minor: state.total,
    currency: input.answers.currency,
    scores,
    score: weightedScore(scores, weights),
  };
}

function uniqueStates(states: State[]): State[] {
  const seen = new Set<string>();
  return states.filter((state) => {
    if (seen.has(state.key)) {
      return false;
    }
    seen.add(state.key);
    return true;
  });
}

function compareStates(left: State, right: State): number {
  return right.score !== left.score ? right.score - left.score : compareText(left.key, right.key);
}
