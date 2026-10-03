/** Dedicated simulation worker keeps particle-budget sampling away from interactive controls. */
import { designSchema } from '@showcrafter/fireworks';
import { measureParticlePeak } from '@/lib/studio/checks';
self.onmessage = (event: MessageEvent<unknown>) => {
  try {
    const peak = measureParticlePeak(designSchema.parse(event.data));
    self.postMessage({ kind: 'ready', peak });
  } catch (error) {
    self.postMessage({
      kind: 'error',
      message: error instanceof Error ? error.message : 'Particle measurement failed.',
    });
  }
};
