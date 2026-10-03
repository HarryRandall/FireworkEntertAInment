/** Converts validated product compositions and show cues to renderer shots. */
import type { Shot } from '@showcrafter/fireworks/view';
import { shotDuration } from '@showcrafter/fireworks/sim';
import type { Design } from '@showcrafter/fireworks/schema';
import type { PlaybackProduct, ShowPage } from './contracts';

const MS_PER_SECOND = 1000; // Stored cue clocks use milliseconds; Viewer uses seconds.
const MM_PER_METRE = 1000; // Composition box pitch is stored in millimetres.
const MAX_TILT_DEG = 85; // The renderer launch schema bounds tilt to +/-85 degrees.
const DEFAULT_SEED = 1; // Stable visual choice for compositions without an authored seed.

function angledDesign(design: Design, angle: number): Design {
  if (!design.launch) return design;
  return {
    ...design,
    launch: {
      ...design.launch,
      tilt_deg: Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, design.launch.tilt_deg + angle)),
    },
  };
}
/** Expands a product at a cue offset in seconds, position in metres and angle in degrees.
 * Does not mutate documents; pack items run sequentially in their published order. */
export function productShots(
  product: PlaybackProduct,
  startSeconds = 0,
  positionMetres = 0,
  angleDegrees = 0,
): Shot[] {
  if (product.kind === 'pack')
    return packShots(product, startSeconds, positionMetres, angleDegrees);
  const composition = product.composition;
  if (!composition) throw new Error(`Missing composition for ${product.name}`);
  return composition.tubes.map((tube) => {
    const effect = product.effects.find((entry) => entry.letter === tube.letter);
    if (!effect) throw new Error(`Missing published design for ${product.name}`);
    const box = composition.box;
    // Centre tube coordinates around the box origin, converting its physical pitch to metres.
    const x =
      box && tube.pos ? ((tube.pos[1] - (box.cols - 1) / 2) * box.pitch_mm) / MM_PER_METRE : 0;
    const z =
      box && tube.pos ? ((tube.pos[0] - (box.rows - 1) / 2) * box.pitch_mm) / MM_PER_METRE : 0;
    const firingMs = tube.t_ms ?? tube.i * (composition.fuse_delay_ms ?? 0);
    return {
      design: angledDesign(effect.design, angleDegrees + tube.angle_deg),
      t0: startSeconds + firingMs / MS_PER_SECOND,
      position: [positionMetres + x, z],
      seed: tube.seed ?? tube.i + DEFAULT_SEED,
    };
  });
}
function packShots(
  product: PlaybackProduct,
  start: number,
  position: number,
  angle: number,
): Shot[] {
  const shots: Shot[] = [];
  let cursor = start;
  for (const item of product.pack_items) {
    for (let unit = 0; unit < item.quantity; unit += 1) {
      const batch = productShots(item.product, cursor, position, angle);
      shots.push(...batch);
      cursor = Math.max(cursor, ...batch.map((shot) => (shot.t0 ?? 0) + shotDuration(shot.design)));
    }
  }
  return shots;
}
/** Resolves show cues from the show-start millisecond clock into deterministic shots. */
export function showShots(show: ShowPage): Shot[] {
  return show.cues.flatMap((cue) => {
    const entry = show.products.find((item) => item.product.id === cue.product_id);
    if (!entry) throw new Error('Show cue has no visible product');
    return productShots(entry.product, cue.t_ms / MS_PER_SECOND, cue.position, cue.angle_deg);
  });
}
