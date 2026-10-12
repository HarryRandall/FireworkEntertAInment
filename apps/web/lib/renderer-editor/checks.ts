/** Simulation-backed checks run before a save, independent of what the preview is showing. */
import { resolveDesign, shotDuration, simulate, type Design } from '@showcrafter/renderer';

/** Live particles and smoke puffs a phone can draw smoothly, from the Studio prototype's budget. */
export const PARTICLE_BUDGET = 22000;
const SAMPLE_RATE_HZ = 30; // Frames per second, a bounded phone playback measurement cadence.
const CONSUMER_HEIGHT_M = 110; // Metres, the prototype's consumer cake height warning.
const LONG_BURN_S = 4.5; // Seconds, the prototype's warning for stars burning near the ground.
const READABLE_STAR_COUNT = 20; // Stars, the prototype's phone readability warning.

/** Sampled peak in seconds from firing. An exceeded result is a lower bound, not the exact peak. */
export interface ParticlePeak {
  count: number;
  timeS: number;
  exceeded: boolean;
}

/** An advisory check; only the particle budget blocks saving. */
export interface DesignCheck {
  id: string;
  passed: boolean;
  message: string;
}

/** Samples live particles at 30 Hz and stops as soon as the budget is exceeded. */
export function measureParticlePeak(document: Design): ParticlePeak {
  const resolved = resolveDesign(document);
  const duration = shotDuration(resolved);
  const frames = Math.ceil(duration * SAMPLE_RATE_HZ);
  let peak: ParticlePeak = { count: 0, timeS: 0, exceeded: false };
  for (let frame = 0; frame <= frames; frame++) {
    const timeS = Math.min(duration, frame / SAMPLE_RATE_HZ);
    const particles = simulate(resolved, timeS);
    const count = particles.kinds.length + particles.smoke.alphas.length;
    if (count > peak.count) peak = { count, timeS, exceeded: count > PARTICLE_BUDGET };
    if (peak.exceeded) return peak;
  }
  return peak;
}

/** Advisory checks on resolved values; the input design is not changed. */
export function authoredChecks(document: Design): DesignCheck[] {
  const resolved = resolveDesign(document);
  const layers = resolved.breaks.flatMap((burst) => burst.layers);
  const checks: DesignCheck[] = [
    {
      id: 'names',
      passed: layers.every((layer) => layer.name.trim() !== ''),
      message: 'Every star group has a name',
    },
  ];
  if (resolved.launch)
    checks.push(
      {
        id: 'height',
        passed: resolved.launch.height_m <= CONSUMER_HEIGHT_M,
        message: 'Height suits a consumer cake',
      },
      {
        id: 'readability',
        passed: layers.length === 0 || layers.some((layer) => layer.count >= READABLE_STAR_COUNT),
        message: 'Burst is big enough to read on a phone',
      },
    );
  if (layers.length > 0)
    checks.push({
      id: 'burn',
      passed: layers.every((layer) => layer.life_s <= LONG_BURN_S),
      message: 'Stars burn out before the ground',
    });
  return checks;
}
