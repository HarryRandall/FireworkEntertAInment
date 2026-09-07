/**
 * Translate a musical impact time into the launch time the renderer needs.
 *
 * Timeline rows store launch times, while the musical grid describes when the
 * visible burst should happen. Keeping that distinction here prevents every
 * planner from independently forgetting the shell's lift phase.
 */
import type { FireworkSpecification } from '@/lib/show-domain';
import {
  compileFireworkDesign,
  scaleDesignForCaliber,
  scaleDesignForEmphasis,
} from '@/lib/fireworks/design';
import { estimateFireworkLiftTimeSeconds } from '@/lib/fireworks/timing';
import { scheduleImpactWithLift, type ImpactTiming } from './impact-clock';
import type { CueEmphasis } from './schemas';

export type { ImpactTiming } from './impact-clock';

/** Renderer-matched lift time after calibre and cue emphasis are applied. */
export function productLiftTimeSeconds(
  product: FireworkSpecification,
  emphasis: CueEmphasis,
): number {
  const compiled =
    product.renderDesign ?? compileFireworkDesign({ legacySpec: product.rawSpec ?? product.spec });
  const scaled = scaleDesignForEmphasis(scaleDesignForCaliber(compiled, product.caliber), emphasis);
  return estimateFireworkLiftTimeSeconds(scaled);
}

/**
 * Return the launch needed for a burst to hit `impactTimeSeconds`.
 *
 * An aerial shell whose lift phase would start before the soundtrack cannot
 * be made exact, so it returns null. Clamping to zero would create a visibly
 * late opening hit and break the beat-accuracy contract. Ground effects have
 * no lift phase and therefore launch directly on the musical impact.
 */
export function scheduleProductForImpact(params: {
  product: FireworkSpecification;
  emphasis: CueEmphasis;
  impactTimeSeconds: number;
}): ImpactTiming | null {
  const { product, emphasis, impactTimeSeconds } = params;
  const liftTimeSeconds = productLiftTimeSeconds(product, emphasis);
  return scheduleImpactWithLift(impactTimeSeconds, liftTimeSeconds);
}

/**
 * Schedule a catalogue item against a musical slot.
 *
 * Direct fireworks use burst compensation. A multishot row expands later into
 * child shots with individual offsets, designs, calibres and launch angles, so
 * its parent slot can only promise the start of the sustained sequence.
 */
export function scheduleProductForCueSlot(params: {
  product: FireworkSpecification;
  emphasis: CueEmphasis;
  targetTimeSeconds: number;
}): ImpactTiming | null {
  const { product, emphasis, targetTimeSeconds } = params;
  if ((product.shotCount ?? 1) > 1) {
    return scheduleImpactWithLift(targetTimeSeconds, 0);
  }
  return scheduleProductForImpact({
    product,
    emphasis,
    impactTimeSeconds: targetTimeSeconds,
  });
}
