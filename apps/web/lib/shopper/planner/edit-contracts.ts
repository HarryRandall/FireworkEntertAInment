/** Closed non-AI edit requests, operations and quantity-aware history documents. */
import { z } from 'zod';

// Stored shopper messages have the schema-plan's 300-character limit.
export const MAX_EDIT_MESSAGE_LENGTH = 300;
/** Tap-to-change choices shared by the UI and server validator. */
export const EDIT_CHIPS = [
  'Longer',
  'Cheaper',
  'More crackle',
  'Bigger finale',
  'Quieter',
  'Swap this firework',
] as const;
/** Concrete solver constraints; currency amounts are integer minor units, length is minutes. */
const editOpSchema = z.discriminatedUnion('op', [
  z
    .object({ op: z.literal('set_budget'), max_minor: z.number().int().nonnegative().safe() })
    .strict(),
  z.object({ op: z.literal('set_length'), length_min: z.number().positive() }).strict(),
  z.object({ op: z.literal('more'), attribute: z.enum(['crackle', 'finale']) }).strict(),
  z.object({ op: z.literal('set_noise'), noise: z.enum(['quiet', 'normal']) }).strict(),
  z.object({ op: z.literal('swap_product'), product_id: z.string().uuid() }).strict(),
]);
/** Structured edit operation, generated on the server rather than trusted from the browser. */
export type EditOp = z.infer<typeof editOpSchema>;
/** Diff entries keep names and unit prices even if the catalogue later changes. */
const diffItemSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unit_price_minor: z.number().int().nonnegative().safe(),
});
/** Quantities and totals before and after an applied edit, in the stated currency's minor units. */
export const editDiffSchema = z.object({
  added: z.array(diffItemSchema),
  removed: z.array(diffItemSchema),
  total_before: z.number().int().nonnegative().safe(),
  total_after: z.number().int().nonnegative().safe(),
  currency: z.string(),
});
/** Persisted edit outcomes include unmatched phrases and infeasible requests. */
export const savedEditSchema = z.object({
  id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  seq: z.number().int().positive(),
  message: z.string(),
  source: z.enum(['chip', 'rule']),
  ops: z.array(editOpSchema),
  diff: editDiffSchema.nullable(),
  outcome: z.enum(['applied', 'clarify', 'infeasible']),
  reply: z.string(),
});
/** Validated edit history for the owned session. */
export type SavedEdit = z.infer<typeof savedEditSchema>;
/** Requests carry the displayed revision and history sequence to detect stale tabs. */
export const editRequestSchema = z
  .object({
    id: z.string().uuid(),
    session: z.string().uuid(),
    candidate: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    seq: z.number().int().positive(),
    source: z.enum(['chip', 'rule']),
    message: z.string().trim().min(1).max(MAX_EDIT_MESSAGE_LENGTH),
    product: z.string().uuid().optional(),
  })
  .strict();
/** Browser request shape excludes privileged solver outputs and money snapshots. */
export type EditRequest = z.infer<typeof editRequestSchema>;
