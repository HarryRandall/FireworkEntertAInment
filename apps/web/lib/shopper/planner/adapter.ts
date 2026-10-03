/** Derives solver timing from the same published compositions used by shopper playback. */
import { resolveDesign } from '@showcrafter/fireworks/schema';
import type { PlanAnswers, PlannerInput } from '@showcrafter/planner';
import type { z } from 'zod';
import type { StorePage } from '../contracts';
import { productShots } from '../playback';
import { type plannerContextSchema } from './contracts';

const MS_PER_SECOND = 1000; // Renderer seconds to stored solver milliseconds.
/** Builds a trusted solver input without changing stock or published documents.
 * The first break is an impact; ground effects begin at ignition. Times are milliseconds. */
export function plannerInput(
  store: StorePage,
  context: z.infer<typeof plannerContextSchema>,
  answers: PlanAnswers,
  age: string,
): PlannerInput {
  const band = context.bands.find((item) => item.band === answers.garden);
  if (!band) throw new Error('Market safety band missing');
  const products = context.products.map((product) => {
    const visible = store.products.find((item) => item.product_id === product.product_id);
    if (!visible) throw new Error('Public planner range changed during read');
    const shots = productShots(visible.playback);
    const impactSeconds = shots.map((shot) => {
      const design = resolveDesign(shot.design);
      const firstBreak = design.breaks.at(0);
      return (shot.t0 ?? 0) + (firstBreak?.at_s ?? 0);
    });
    if (impactSeconds.length === 0) throw new Error('Published product has no shots');
    return {
      ...product,
      impact_delay_ms: Math.min(
        product.duration_ms,
        Math.round(Math.min(...impactSeconds) * MS_PER_SECOND),
      ),
    };
  });
  return {
    answers,
    store_id: store.store.id,
    market: context.market,
    sale: context.sale,
    safety_band: band,
    age_confirmation: { confirmed_at: age, minimum_age: context.market.min_age },
    products,
    music: null,
  };
}
