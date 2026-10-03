// Package-owned snapshots mirror catalogue, store_prices and planning answer columns.
import { z } from 'zod';
import { MAX_SHOW_DURATION_MS, MS_PER_MINUTE } from './config.ts';
import { musicAnalysisSchema } from '../music/analysis.ts';

// Database noise ordinals range from quiet (0) to loud (3).
const MAX_NOISE_LEVEL = 3;
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positiveClock = z.number().int().positive().max(MAX_SHOW_DURATION_MS);
const text = z.string().min(1);
const garden = z.enum(['small', 'medium', 'large']);

/** Answers use integer minor currency units and minutes; soundtrack is a track UUID or null. */
export const planAnswersSchema = z
  .object({
    occasion: text,
    garden,
    budget_minor: money,
    currency: z.string().regex(/^[A-Z]{3}$/),
    noise: z.enum(['quiet', 'normal', 'loud']),
    looks: z.array(text),
    length_min: z
      .number()
      .finite()
      .positive()
      .max(MAX_SHOW_DURATION_MS / MS_PER_MINUTE),
    soundtrack: z.string().uuid().nullable(),
  })
  .strict();

/** One complete sellable unit, including cakes; timing is milliseconds from its ignition. */
export const plannerProductSchema = z
  .object({
    product_id: z.string().uuid(),
    store_id: z.string().uuid(),
    // Published selection packs are immutable product rows without composition versions.
    current_version_id: z.string().uuid().nullable(),
    status: z.enum(['draft', 'needs_review', 'published', 'archived']),
    kind: text,
    price_minor: money,
    currency: z.string().regex(/^[A-Z]{3}$/),
    stock_qty: z.number().int().nonnegative(),
    hidden: z.boolean(),
    min_safety_distance_m: z.number().finite().nonnegative().nullable(),
    noise_level: z.number().int().min(0).max(MAX_NOISE_LEVEL).nullable(),
    safety_confirmed: z.boolean(),
    has_bangs: z.boolean(),
    has_crackle: z.boolean(),
    has_whistle: z.boolean(),
    duration_ms: positiveClock,
    // Adapter derives the first headline impact from the published design/composition, never apex guesses.
    impact_delay_ms: money,
    energy: z.number().finite().min(0).max(1),
    colours: z.array(text),
    tags: z.array(text),
    product_market: z
      .object({
        market: text,
        allowed: z.boolean(),
        legal_category: text,
        min_age: z.number().int().nonnegative().nullable(),
        confirmed: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (product) =>
      (product.current_version_id !== null || product.kind === 'pack') &&
      product.impact_delay_ms <= product.duration_ms,
    {
      message:
        'Non-pack products require a composition version and impact must fall within duration',
    },
  );

/** Trusted sale_open and market snapshots must be resolved for this store and request time. */
export const plannerInputSchema = z
  .object({
    answers: planAnswersSchema,
    store_id: z.string().uuid(),
    market: z.object({ code: text, currency: text, min_age: money, enabled: z.boolean() }).strict(),
    sale: z.object({ open: z.boolean(), evaluated_at: z.string().datetime() }).strict(),
    age_confirmation: z
      .object({
        confirmed_at: z.string().datetime(),
        minimum_age: money,
      })
      .strict()
      .nullable(),
    safety_band: z
      .object({
        market: text,
        band: garden,
        max_distance_m: z.number().finite().nonnegative(),
        allowed_categories: z.array(text),
      })
      .strict(),
    products: z.array(plannerProductSchema),
    music: musicAnalysisSchema.nullable(),
    // An edit can require a pacing mood; omitted inputs retain the general ranked search.
    preferred_mood: z.enum(['gentle', 'balanced', 'big_finale']).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const ids = input.products.map((product) => product.product_id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate product snapshot' });
    }
    if (input.music !== null && input.answers.soundtrack === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Music requires a soundtrack track',
      });
    }
  });

/** Validated, immutable-by-convention solver input; no database or app imports. */
export type PlannerInput = z.infer<typeof plannerInputSchema>;
/** Resolved per-store unit price, stock, verified safety and published timing snapshot. */
export type PlannerProduct = z.infer<typeof plannerProductSchema>;
/** Stored session answer shape with explicit currency and soundtrack selection. */
export type PlanAnswers = z.infer<typeof planAnswersSchema>;
