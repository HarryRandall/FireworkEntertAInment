/** Trail looks come from the validated renderer templates already matching the prototype. */
import { effectTemplates } from '@showcrafter/fireworks';
import type { Trail } from '@showcrafter/fireworks/schema';

const LOOK_KEYS = [
  'chrysanthemum',
  'willow',
  'brocade',
  'kamuro',
  'palm',
  'horsetail',
  'glitter',
  'flitter',
  'dahlia',
];
/** A named renderer trail, copied before applying to a draft. */
export interface TrailLook {
  key: string;
  trail: Trail;
}
/** Proven trail choices, including short sparks from the dahlia template. */
export const trailLooks: readonly TrailLook[] = LOOK_KEYS.flatMap((key) => {
  const trail = effectTemplates
    .find((template) => template.key === key)
    ?.design.breaks.at(0)
    ?.layers.at(0)?.trail;
  return trail ? [{ key, trail }] : [];
});
/** Finds a preset only when every stored trail field matches; otherwise the look remains custom. */
export function trailLook(trail: Trail): string {
  return (
    trailLooks.find((look) => JSON.stringify(look.trail) === JSON.stringify(trail))?.key ?? 'custom'
  );
}
