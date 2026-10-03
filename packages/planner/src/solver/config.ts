// Bounded search budgets and initial product judgements are deterministic, never time-based.
import type { SolverWeights } from './types.ts';

// Ranking judgement: pacing 35%, variety 25%, budget and look match 20% each.
const PACING_WEIGHT = 0.35;
const VARIETY_WEIGHT = 0.25;
const BUDGET_WEIGHT = 0.2;
const LOOK_WEIGHT = 0.2;

/** Initial dimensionless priorities: pacing leads, followed by variety and equal value/style shares. */
export const DEFAULT_SOLVER_WEIGHTS: Readonly<SolverWeights> = Object.freeze({
  variety: VARIETY_WEIGHT,
  pacing: PACING_WEIGHT,
  budget_use: BUDGET_WEIGHT,
  look_match: LOOK_WEIGHT,
});
/** Cache namespace, changed when selection or timing behaviour changes. */
export const SOLVER_VERSION = 'solver-1.0.0';
// Search tuning: 12 surviving assortments, 24 ranked products plus 4 value/duration fallbacks per mood.
export const BEAM_WIDTH = 12;
export const SHORTLIST_SIZE = 24;
export const FALLBACK_COUNT = 4;
// Work and output ceiling: 24 individually purchased units, avoiding runaway zero-price inventory.
export const MAX_PLAN_UNITS = 24;
// Milliseconds per second/minute, used at audio and answer boundaries.
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60000;
// Search retains four candidate assortments per depth to provide material alternatives.
export const RETAINED_PER_DEPTH = 4;
// At most 75% quantity overlap is considered a materially changed assortment.
export const MAX_ALTERNATIVE_OVERLAP = 0.75;

// PostgreSQL integer clock ceiling for persisted show duration and cue milliseconds.
export const MAX_SHOW_DURATION_MS = 2147483647;
