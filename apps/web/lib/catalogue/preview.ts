/** Validates stored renderer documents and resolves product tube bindings for catalogue stills. */
import { designSchema } from '@showcrafter/fireworks';
import type { Shot } from '@showcrafter/fireworks/view';
import { compositionSchema } from '@/lib/documents/composition.generated';
import type { CataloguePreview } from './types';

const MILLISECONDS_PER_SECOND = 1000; // Stored tube clocks use milliseconds; the renderer uses seconds.
const MILLIMETRES_PER_METRE = 1000; // Composition box pitch is stored in millimetres; placement uses metres.

/** Validates an unknown stored design before it reaches WebGL; malformed data remains a failure. */
export function effectPreview(document: unknown): CataloguePreview {
  return { design: designSchema.parse(document) };
}
/** Resolves validated tube milliseconds, degrees and box millimetres into renderer seconds and metres.
 * Returns null for an empty composition; neither documents nor binding designs are mutated. */
export function productPreview(
  document: unknown,
  bindings: Map<string, CataloguePreview>,
): CataloguePreview | null {
  const composition = compositionSchema.parse(document);
  const shots: Shot[] = composition.tubes.map((tube) => {
    const preview = bindings.get(tube.letter);
    if (!preview) throw new Error(`Missing published effect for tube ${tube.letter}`);
    const base = preview.design;
    // Tube angle adds to the effect's authored lean; the source document stays immutable.
    const design = base.launch
      ? { ...base, launch: { ...base.launch, tilt_deg: base.launch.tilt_deg + tube.angle_deg } }
      : base;
    const box = composition.box;
    // Centre the grid around the stage origin by subtracting half of each box span.
    const position: [number, number] =
      box && tube.pos
        ? [
            ((tube.pos[1] - (box.cols - 1) / 2) * box.pitch_mm) / MILLIMETRES_PER_METRE,
            ((tube.pos[0] - (box.rows - 1) / 2) * box.pitch_mm) / MILLIMETRES_PER_METRE,
          ]
        : [0, 0];
    return {
      design,
      position,
      t0: (tube.t_ms ?? 0) / MILLISECONDS_PER_SECOND,
      seed: tube.seed ?? tube.i,
    };
  });
  const first = shots.at(0);
  return first ? { design: first.design, shots } : null;
}
