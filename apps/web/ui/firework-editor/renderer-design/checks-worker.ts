/** Dedicated simulation worker keeps particle sampling away from the editor's controls. */
import { designSchema } from '@showcrafter/renderer';
import { measureParticlePeak } from '@/lib/renderer-editor/checks';

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
