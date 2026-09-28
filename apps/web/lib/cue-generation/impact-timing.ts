/**
 * Translate a musical impact time into the launch time the renderer needs.
 *
 * Timeline rows store launch times, while the musical grid describes when the
 * visible burst should happen. Keeping that distinction here prevents every
 * planner from independently forgetting the shell's lift phase.
 */
import type { FireworkSpecification } from '@/lib/show-domain';
import type { ProductTimingProfile } from '@/lib/fireworks/timing-profile';
import { scaleDesignForCaliber, scaleDesignForEmphasis } from '@showcrafter/fireworks/design';
import { estimateFireworkLiftTimeSeconds } from '@showcrafter/fireworks/timing';
import { scheduleImpactWithLift, type ImpactTiming } from './impact-clock';
import type { CueEmphasis } from './schemas';

export type { ImpactTiming } from './impact-clock';

/** Renderer-matched lift time after calibre and cue emphasis are applied. */
export function productLiftTimeSeconds(
  product: FireworkSpecification,
  emphasis: CueEmphasis,
): number {
  const compiled = product.renderDesign;
  if (!compiled) return Number.NaN;
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
 * Schedule a catalogue item against a musical slot so its first visible burst
 * lands on the slot.
 *
 * Direct fireworks compensate their own lift. A multishot expands later into
 * child shots with individual offsets and lifts, so it needs its resolved
 * timing profile: the sequence launches early by the first child's impact
 * offset. Without a complete profile the sequence can only start on the slot.
 */
export function scheduleProductForCueSlot(params: {
  product: FireworkSpecification;
  emphasis: CueEmphasis;
  targetTimeSeconds: number;
  timingProfile?: ProductTimingProfile;
}): ImpactTiming | null {
  const { product, emphasis, targetTimeSeconds, timingProfile } = params;
  if ((product.shotCount ?? 1) > 1) {
    const firstImpact =
      timingProfile?.completeness === 'complete' ? timingProfile.firstImpactOffsetSeconds : null;
    return scheduleImpactWithLift(targetTimeSeconds, firstImpact ?? 0);
  }
  return scheduleProductForImpact({
    product,
    emphasis,
    impactTimeSeconds: targetTimeSeconds,
  });
}
