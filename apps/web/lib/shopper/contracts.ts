/** Validates the restricted public page payloads before they reach shopper rendering. */
import { z } from 'zod';
import { designSchema, type Design } from '@showcrafter/fireworks/schema';
import { compositionSchema, type Composition } from '../documents/composition.generated';

const uuid = z.string().uuid();
const minorUnits = z.number().int().nonnegative().safe();
const publicPath = z
  .string()
  .min(1)
  .refine(
    (path) => !path.split('/').some((part) => ['', '.', '..'].includes(part)),
    'Invalid storage path',
  );
const posterSchema = z.object({ path: publicPath, renderer: z.string().min(1) }).nullable();
/** Published product documents, including recursive immutable selection-pack contents. */
export interface PlaybackProduct {
  id: string;
  name: string;
  kind: string;
  version_id: string | null;
  composition: Composition | null;
  poster: { path: string; renderer: string } | null;
  effects: { letter: string; design: Design; renderer: string }[];
  pack_items: { quantity: number; product: PlaybackProduct }[];
}
/** Checks current designs, compositions and nested pack contents from privileged readers. */
export const playbackSchema: z.ZodType<PlaybackProduct> = z.lazy(() =>
  z.object({
    id: uuid,
    name: z.string(),
    kind: z.string(),
    version_id: uuid.nullable(),
    composition: compositionSchema.nullable(),
    poster: posterSchema,
    effects: z.array(
      z.object({ letter: z.string(), design: designSchema, renderer: z.string().min(1) }),
    ),
    pack_items: z.array(
      z.object({ quantity: z.number().int().positive(), product: playbackSchema }),
    ),
  }),
);
/** Public price, stock and physical facts for one visible store product. */
export const storeProductSchema = z.object({
  product_id: uuid,
  name: z.string(),
  kind: z.string(),
  price_minor: minorUnits,
  currency: z.string().regex(/^[A-Z]{3}$/),
  stock_qty: z.number().int().nonnegative(),
  noise_level: z.number().nullable(),
  min_safety_distance_m: z.number().nullable(),
  duration_ms: z.number().nonnegative(),
  colours: z.array(z.string()),
  tags: z.array(z.string()),
  playback: playbackSchema,
});
/** The public store reader deliberately excludes retailer administration facts. */
export const storePageSchema = z.object({
  store: z.object({
    id: uuid,
    name: z.string(),
    slug: z.string(),
    market: z.string(),
    address: z.string().nullable(),
    postcode: z.string().nullable(),
  }),
  organisation: z.object({ id: uuid, name: z.string() }),
  branding: z
    .object({
      accent: z
        .string()
        .regex(/^#[0-9a-f]{6}$/)
        .nullable(),
      welcome: z.string().nullable(),
      footer: z.string().nullable(),
      logo_path: publicPath.nullable(),
    })
    .nullable(),
  products: z.array(storeProductSchema),
  collections: z.array(
    z.object({ id: uuid, name: z.string(), slug: z.string(), product_ids: z.array(uuid) }),
  ),
  shows: z.array(z.object({ id: uuid, name: z.string() })),
});
/** Retailer show cues use milliseconds from show start, metres and degrees. */
export const showPageSchema = z.object({
  id: uuid,
  name: z.string(),
  duration_ms: z.number().nonnegative(),
  price_minor: minorUnits,
  currency: z.string().regex(/^[A-Z]{3}$/),
  available: z.boolean(),
  cues: z.array(
    z.object({
      t_ms: z.number().int().nonnegative(),
      product_id: uuid,
      position: z.number(),
      angle_deg: z.number(),
    }),
  ),
  products: z.array(z.object({ quantity: z.number().int().positive(), product: playbackSchema })),
});
const targetSchema = z.enum(['product', 'pack', 'collection', 'show', 'planner', 'store']);
/** Public QR resolution, including organisation-wide store choice and retired-target recovery. */
export const qrSchema = z.union([
  z.object({
    qr_id: uuid,
    store_id: uuid,
    store_slug: z.string(),
    fallback: z.boolean(),
    target_type: targetSchema,
    target_id: uuid.nullable(),
  }),
  z.object({
    qr_id: uuid,
    pick_store: z.literal(true),
    stores: z.array(
      z.object({
        id: uuid,
        name: z.string(),
        slug: z.string(),
        target_type: targetSchema,
        target_id: uuid.nullable(),
      }),
    ),
  }),
]);
/** Validated public product metadata. */
export type StoreProduct = z.infer<typeof storeProductSchema>;
/** Validated public shop branding and range. */
export type StorePage = z.infer<typeof storePageSchema>;
/** Validated retailer show playback and pricing. */
export type ShowPage = z.infer<typeof showPageSchema>;
