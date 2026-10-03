/** Validated account snapshots and quantity limits shared by reads and controls. */
import { z } from 'zod';
/** PostgreSQL smallint quantity ceiling, in individual products. */
export const MAX_LIST_QUANTITY = 32767;
/** Version of the independent activity-sharing and marketing consent text. */
export const CONSENT_VERSION = 'shopper-consent-1';
const uuid = z.string().uuid();
const money = z.number().int().nonnegative().safe();
/** Owned till list with immutable minor-unit prices and readable product labels. */
export const listSchema = z.object({
  id: uuid,
  store_id: uuid,
  store_name: z.string(),
  store_slug: z.string(),
  organisation_id: uuid,
  till_code: z.string().regex(/^[0-9]{16}$/),
  valid_until: z.string(),
  status: z.enum(['open', 'redeemed', 'expired']),
  items: z.array(
    z.object({
      product_id: uuid,
      name: z.string(),
      quantity: z.number().int().positive(),
      unit_price_minor: money,
      currency: z.string().regex(/^[A-Z]{3}$/),
    }),
  ),
});
/** Restricts an enriched account payload to the caller-owned presentation fields. */
export const accountSchema = z.object({
  lists: z.array(listSchema),
  shows: z.array(
    z.object({ id: uuid, name: z.string(), version_id: uuid, session_id: uuid.nullable() }),
  ),
  plans: z.array(
    z.object({
      id: uuid,
      store_slug: z.string(),
      store_name: z.string(),
      created_at: z.string(),
      status: z.string(),
    }),
  ),
  follows: z.array(
    z.object({
      organisation_id: uuid,
      name: z.string(),
      visible_to_shop: z.boolean(),
      marketing_opt_in: z.boolean(),
      consent_text_version: z.string(),
    }),
  ),
  requests: z.array(
    z.object({
      id: uuid,
      kind: z.enum(['export', 'delete']),
      status: z.enum(['pending', 'done', 'failed']),
    }),
  ),
});
/** Stored list presentation type. */
export type ShopperList = z.infer<typeof listSchema>;
/** Owned account presentation type. */
export type ShopperAccount = z.infer<typeof accountSchema>;
/** Expected write result, with unexpected failures thrown by the server boundary. */
export type ListResult = { status: 'ok'; id?: string } | { status: 'invalid'; message: string };
