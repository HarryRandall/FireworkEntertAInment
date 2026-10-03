/** Bounded, non-personal shopper activity accepted by the analytics RPC. */
import { z } from 'zod';
/** Transport tuning: at most twenty small events per keepalive request. */
export const EVENT_BATCH_SIZE = 20;
/** RPC visit-key limit, in characters; keys contain only random UUIDs. */
const SESSION_KEY_LIMIT = 128;
const uuid = z.string().uuid();
/** Only shopper-path events and database-validated UUID context may cross the boundary. */
export const eventSchema = z
  .object({
    type: z.enum([
      'scan',
      'store_view',
      'product_view',
      'play',
      'plan_start',
      'plan_pick',
      'edit',
      'something_different',
      'list_add',
      'list_saved',
      'till_code_shown',
    ]),
    store: uuid,
    context: z
      .object({
        qr_code_id: uuid.optional(),
        show_id: uuid.optional(),
        product_id: uuid.optional(),
        plan_session_id: uuid.optional(),
      })
      .strict()
      .default({}),
    props: z.object({ list_id: uuid.optional() }).strict().default({}),
  })
  .strict();
/** Event payload excludes identity, prices, names and typed edit messages. */
export type ShopperEvent = z.infer<typeof eventSchema>;
/** The client sends one bounded batch with a visit-scoped random key. */
export const batchSchema = z
  .object({
    session_key: z.string().min(1).max(SESSION_KEY_LIMIT),
    events: z.array(eventSchema).min(1).max(EVENT_BATCH_SIZE),
  })
  .strict();
