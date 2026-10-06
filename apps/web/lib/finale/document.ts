/** Transport document for exact Finale syntax; bindings identify stored fireworks. */
import { z } from 'zod';

const MAX_TUBES = 10_000; // Exact syntax parsing budget, tubes.
const MAX_ANGLE_DEGREES = 90; // Finale exact syntax angle extent, degrees.

/** Validates the transport shape before converting it to persistent multishot rows. */
export const cakeDocumentSchema = z
  .object({
    bindings: z.record(z.string().regex(/^[a-z]{1,2}$/), z.string().uuid()),
    composition: z.object({
      tubes: z
        .array(
          z.object({
            i: z.number().int().nonnegative(),
            letter: z.string().regex(/^[a-z]{1,2}$/),
            t_ms: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
            angle_deg: z.number().finite().min(-MAX_ANGLE_DEGREES).max(MAX_ANGLE_DEGREES),
          }),
        )
        .max(MAX_TUBES),
      box: z
        .object({
          rows: z.number().int().positive(),
          cols: z.number().int().positive(),
          pitch_mm: z.number().positive(),
        })
        .optional(),
      fuse_delay_ms: z.number().nonnegative().optional(),
    }),
  })
  .superRefine((document, context) => {
    const indices = new Set<number>();
    for (const tube of document.composition.tubes) {
      if (!Object.hasOwn(document.bindings, tube.letter) || indices.has(tube.i))
        context.addIssue({
          code: 'custom',
          message: 'Each tube needs a unique index and firework binding.',
        });
      indices.add(tube.i);
    }
  });
export type CakeDocument = z.infer<typeof cakeDocumentSchema>;
export type CakeEffect = {
  id: string;
  name: string;
  document: { kind: string; breaks: readonly unknown[] };
};

/** Orders by firing time, preserving simultaneous tube order and removing unused bindings. */
export function orderTubes(document: CakeDocument): CakeDocument {
  const tubes = [...document.composition.tubes].sort((a, b) => a.t_ms - b.t_ms);
  const letters = new Set(tubes.map((tube) => tube.letter));
  return {
    composition: { ...document.composition, tubes },
    bindings: Object.fromEntries(
      Object.entries(document.bindings).filter(([letter]) => letters.has(letter)),
    ),
  };
}
