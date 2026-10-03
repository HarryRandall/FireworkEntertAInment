// Public timing, music validation and deterministic whole-unit planning API.
export { scheduleImpactWithLift, type ImpactTiming } from './timing/impact-clock.ts';
export { GENERATED_LAUNCH_INTERVAL_SECONDS } from './timing/launch-spacing.ts';
export { musicAnalysisSchema, type MusicAnalysis } from './music/analysis.ts';
export { solvePlan } from './solver/solve.ts';
export {
  plannerInputSchema,
  planAnswersSchema,
  plannerProductSchema,
  type PlannerInput,
  type PlannerProduct,
  type PlanAnswers,
} from './solver/input.ts';
export { DEFAULT_SOLVER_WEIGHTS, SOLVER_VERSION } from './solver/config.ts';
export type {
  PlanCandidate,
  PlanCue,
  PlanMood,
  PlanScores,
  PlanResult,
  SolverWeights,
} from './solver/types.ts';
