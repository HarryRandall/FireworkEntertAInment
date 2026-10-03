// Generated from supabase/documents/composition.v1.json; run pnpm db:validators.
import { z } from 'zod';
export const compositionSchema = z
  .object({
    box: z
      .object({
        rows: z.number().int().gte(1),
        cols: z.number().int().gte(1),
        pitch_mm: z.number().gt(0),
      })
      .strict()
      .optional(),
    tubes: z.array(
      z
        .object({
          i: z.number().int().gte(0),
          letter: z.string().regex(new RegExp('^[a-z]{1,2}$')),
          t_ms: z.union([z.number().int().gte(0), z.null()]),
          angle_deg: z.number().gte(-90).lte(90),
          pos: z.array(z.number().int().gte(0)).min(2).max(2).optional(),
          seed: z.number().int().gte(0).lte(4294967295).optional(),
        })
        .strict(),
    ),
    fuse_delay_ms: z.number().int().gte(0).optional(),
  })
  .strict();
export type Composition = z.infer<typeof compositionSchema>;
