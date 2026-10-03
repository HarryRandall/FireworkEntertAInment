/** Validated planner requests and persisted snapshots across the server boundary. */
import { z } from 'zod';
import { savedEditSchema } from './edit-contracts';
import {
  planAnswersSchema,
  plannerInputSchema,
  plannerProductSchema,
} from '@showcrafter/planner/input';

// Prototype currency controls use hundredths; duration controls use whole minutes.
const BUDGET_MIN_MINOR = 4000;
const BUDGET_MAX_MINOR = 40000;
const BUDGET_STEP_MINOR = 1000;
const DEFAULT_BUDGET_MINOR = 15000;
const LENGTH_MAX_MINUTES = 10;
const DEFAULT_LENGTH_MINUTES = 4;
const QUESTION_COUNT = 5; // Occasion, garden, budget, noise, looks plus length.
const MAX_CANDIDATES = 10; // Solver's bounded ranked prefix limit.
/** Limits and initial values shared by validation and the prototype controls. */
export const PLANNER_LIMITS = {
  budgetMin: BUDGET_MIN_MINOR,
  budgetMax: BUDGET_MAX_MINOR,
  budgetStep: BUDGET_STEP_MINOR,
  lengthMin: 2,
  lengthMax: LENGTH_MAX_MINUTES,
  defaultBudget: DEFAULT_BUDGET_MINOR,
  defaultLength: DEFAULT_LENGTH_MINUTES,
  questionCount: QUESTION_COUNT,
  maxCandidates: MAX_CANDIDATES,
};
/** Shopper input is bounded independently of the more general solver schema. */
export const shopperAnswersSchema = planAnswersSchema.extend({
  occasion: z.enum(['Bonfire Night', 'New Year', 'Diwali', 'Birthday', 'Wedding', 'Just because']),
  budget_minor: z.number().int().min(PLANNER_LIMITS.budgetMin).max(PLANNER_LIMITS.budgetMax),
  length_min: z.number().int().min(PLANNER_LIMITS.lengthMin).max(PLANNER_LIMITS.lengthMax),
  looks: z.array(
    z.enum(['Gold', 'Colour', 'Silver', 'Crackle', 'Willow', 'Comets', 'Shapes', 'Rockets']),
  ),
  soundtrack: z.null(),
});
/** Unknown action input never reaches a privileged client unchecked. */
export const startRequestSchema = z
  .object({
    slug: z.string().min(1),
    request: z.string().uuid(),
    answers: shopperAnswersSchema,
    age: z.string().datetime(),
    qr: z.string().uuid().nullable(),
  })
  .strict();
/** Public planning context omits playback, which is supplied by the existing store reader. */
export const plannerContextSchema = z.object({
  market: plannerInputSchema.innerType().shape.market,
  sale: plannerInputSchema.innerType().shape.sale,
  bands: z.array(plannerInputSchema.innerType().shape.safety_band),
  products: z.array(plannerProductSchema.innerType().omit({ impact_delay_ms: true })),
});
/** Candidate history validates integer money and show-start millisecond clocks. */
const savedCandidateSchema = z.object({
  id: z.string().uuid(),
  rank: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  name: z.string().nullable(),
  mood: z.string(),
  cues: z.array(
    z.object({
      t_ms: z.number().int().nonnegative(),
      product_id: z.string().uuid(),
      position: z.number(),
      angle_deg: z.number(),
    }),
  ),
  total_minor: z.number().int().nonnegative().safe(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  duration_ms: z.number().int().nonnegative(),
});
/** Complete owned session data, retaining its exact solver snapshot for alternatives. */
export const savedPlanSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid(),
  solver: z.string(),
  input_hash: z.string(),
  solver_snapshot: plannerInputSchema,
  plan_candidates: z.array(savedCandidateSchema).min(1),
  plan_edits: z.array(savedEditSchema),
});
/** Owned and validated persisted planning session. */
export type SavedPlan = z.infer<typeof savedPlanSchema>;
/** Expected failures retain answers and do not hide unexpected infrastructure errors. */
export type PlannerActionResult =
  | { status: 'ok'; plan: SavedPlan }
  | {
      status: 'unavailable' | 'rate_limited' | 'infeasible' | 'exhausted' | 'invalid';
      message: string;
    };

/** Validated shopper controls exclude soundtrack and constrain the supported choices. */
export type ShopperAnswers = z.infer<typeof shopperAnswersSchema>;
