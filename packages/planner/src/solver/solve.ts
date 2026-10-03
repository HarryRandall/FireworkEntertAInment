// Public synchronous planning boundary validates unknown input and returns persistable ranked candidates.
import { z } from 'zod';
import { plannerInputSchema } from './input.ts';
import type { PlanCandidate, PlanResult } from './types.ts';
import { DEFAULT_SOLVER_WEIGHTS, MAX_ALTERNATIVE_OVERLAP } from './config.ts';
import { eligibleProducts, eligibilityFailure } from './eligibility.ts';
import { compareText, hashPlannerInput } from './hash.ts';
import { searchMood } from './search.ts';

// One visible plan by default; callers request a larger prefix for 'something different'.
const DEFAULT_CANDIDATE_COUNT = 1;
// Small bounded ranked prefix, not an unlimited catalogue of combinations.
const MAX_CANDIDATE_COUNT = 10;
const weight = z.number().finite().nonnegative();
const optionsSchema = z
  .object({
    candidate_count: z
      .number()
      .int()
      .positive()
      .max(MAX_CANDIDATE_COUNT)
      .default(DEFAULT_CANDIDATE_COUNT),
    weights: z
      .object({ variety: weight, pacing: weight, budget_use: weight, look_match: weight })
      .strict()
      .default(DEFAULT_SOLVER_WEIGHTS)
      .refine((weights) => {
        const sum = Object.values(weights).reduce((total, value) => total + value, 0);
        return Number.isFinite(sum) && sum > 0;
      }, 'Weights need a positive finite sum'),
  })
  .strict();

/** Validates unknown snapshots and returns deterministic plans; clocks are ms from show/audio start, prices are minor units. */
export function solvePlan(rawInput: unknown, rawOptions: unknown = {}): PlanResult {
  const parsed = plannerInputSchema.safeParse(rawInput);
  const options = optionsSchema.safeParse(rawOptions);
  if (!parsed.success || !options.success) {
    const issues = [
      ...(!parsed.success ? parsed.error.issues : []),
      ...(!options.success ? options.error.issues : []),
    ];
    return {
      status: 'invalid_input',
      issues: issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    };
  }
  const input = parsed.data;
  const { weights, candidate_count } = options.data;
  const hashes = hashPlannerInput(input, weights);
  const refusal = eligibilityFailure(input);
  if (refusal !== null) {
    return { status: 'infeasible', input_hash: hashes.input_hash, reason: refusal };
  }
  const products = eligibleProducts(input);
  if (products.length === 0) {
    return {
      status: 'infeasible',
      input_hash: hashes.input_hash,
      reason: 'No safe in-stock product fits this budget and request',
    };
  }
  const moods =
    input.preferred_mood !== undefined
      ? [input.preferred_mood]
      : (['gentle', 'balanced', 'big_finale'] as const);
  const pool = moods
    .flatMap((mood) => searchMood(products, input, mood, weights))
    .sort(compareCandidates);
  const diverse = diverseCandidates(pool);
  if (diverse.length === 0) {
    return {
      status: 'infeasible',
      input_hash: hashes.input_hash,
      reason: 'No complete safe plan fits the available soundtrack duration',
    };
  }
  return {
    status: 'ok',
    ...hashes,
    candidates: diverse.slice(0, candidate_count),
    exhausted: diverse.length <= candidate_count,
  };
}

function compareCandidates(left: PlanCandidate, right: PlanCandidate): number {
  return right.score !== left.score
    ? right.score - left.score
    : compareText(candidateKey(left), candidateKey(right));
}

function candidateKey(candidate: PlanCandidate): string {
  return `${candidate.mood}:${candidate.cues.map((cue) => cue.product_id).join(',')}`;
}

function diverseCandidates(pool: PlanCandidate[]): PlanCandidate[] {
  const chosen: PlanCandidate[] = [];
  for (const candidate of pool) {
    if (chosen.every((previous) => materiallyDifferent(previous, candidate))) {
      chosen.push({ ...candidate, rank: chosen.length + 1 });
    }
  }
  return chosen;
}

function materiallyDifferent(left: PlanCandidate, right: PlanCandidate): boolean {
  if (left.headline_product_id !== right.headline_product_id) {
    return true;
  }
  const counts = new Map<string, number>();
  for (const cue of left.cues) {
    counts.set(cue.product_id, (counts.get(cue.product_id) ?? 0) + 1);
  }
  let shared = 0;
  for (const cue of right.cues) {
    const remaining = counts.get(cue.product_id) ?? 0;
    if (remaining > 0) {
      shared += 1;
      counts.set(cue.product_id, remaining - 1);
    }
  }
  return shared / Math.max(left.cues.length, right.cues.length) <= MAX_ALTERNATIVE_OVERLAP;
}
