// Generated from supabase/documents/cues.v1.json; run pnpm db:validators.
import { z } from 'zod';
export const cuesSchema = z
  .array(
    z
      .object({
        t_ms: z.number().int().gte(0),
        product_id: z
          .string()
          .regex(
            new RegExp(
              '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
            ),
          ),
        position: z.number(),
        angle_deg: z.number().gte(-90).lte(90),
        beat: z.union([z.number().int().gte(0), z.null()]).optional(),
      })
      .strict(),
  )
  .min(1);
export type Cues = z.infer<typeof cuesSchema>;
