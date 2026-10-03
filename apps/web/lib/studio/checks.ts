/** Simulation-backed publishing checks use authored designs, independent of preview visibility. */
import { resolveDesign, shotDuration, simulate, type Design } from '@showcrafter/fireworks';

/** Live additive particles and smoke puffs allowed by the Studio prototype's phone budget. */
export const PARTICLE_BUDGET = 22000;
const SAMPLE_RATE_HZ = 30; // Frames per second, a bounded phone playback measurement cadence.
const CONSUMER_HEIGHT_M = 110; // Metres, studio.html's visual consumer-cake warning threshold.
const LONG_BURN_S = 4.5; // Seconds, studio.html's warning for stars burning near the ground.
const READABLE_STAR_COUNT = 20; // Stars, studio.html's phone readability warning threshold.

/** Sampled peak from firing, including CPU reference sprays, heads, halos, flashes and smoke. */
export interface ParticlePeak {
  count: number;
  timeS: number;
  exceeded: boolean;
}
/** Checks distinguish the publishing block from advisory authored-value warnings. */
export interface StudioCheck {
  id: string;
  passed: boolean;
  message: string;
}
/** Measures live frames at 30 Hz in firing-relative seconds; stops once the budget is exceeded.
 * Validated designs are unchanged. An exceeded result is a lower bound, not an exact peak.
 */
export function measureParticlePeak(document: Design): ParticlePeak {
  const duration = shotDuration(document);
  const frames = Math.ceil(duration * SAMPLE_RATE_HZ);
  let peak: ParticlePeak = { count: 0, timeS: 0, exceeded: false };
  for (let frame = 0; frame <= frames; frame++) {
    const timeS = Math.min(duration, frame / SAMPLE_RATE_HZ);
    const particles = simulate(document, timeS);
    const count = particles.kinds.length + particles.smoke.alphas.length;
    if (count > peak.count) peak = { count, timeS, exceeded: count > PARTICLE_BUDGET };
    if (peak.exceeded) return peak;
  }
  return peak;
}
/** Returns advisory name and unusual-value checks using resolved stored units, without mutation. */
export function authoredChecks(document: Design, effectName: string): StudioCheck[] {
  const resolved = resolveDesign(document);
  const layers = resolved.breaks.flatMap((burst) => burst.layers);
  return [
    {
      id: 'names',
      passed: effectName.trim() !== '' && layers.every((layer) => layer.name.trim() !== ''),
      message: 'Firework and star groups have names',
    },
    {
      id: 'height',
      passed: resolved.launch === null || resolved.launch.height_m <= CONSUMER_HEIGHT_M,
      message: 'Height suits a consumer cake',
    },
    {
      id: 'burn',
      passed: layers.every((layer) => layer.life_s <= LONG_BURN_S),
      message: 'Stars burn out before the ground',
    },
    {
      id: 'readability',
      passed:
        resolved.launch === null || layers.some((layer) => layer.count >= READABLE_STAR_COUNT),
      message: 'Burst is big enough to read on a phone',
    },
  ];
}
