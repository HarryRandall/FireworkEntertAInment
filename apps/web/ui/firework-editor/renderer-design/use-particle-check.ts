/** Each design snapshot gets its own cancellable off-thread measurement, never a stale pass. */
'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Design } from '@showcrafter/renderer';

const MEASURE_DELAY_MS = 400; // UI tuning: wait for a slider drag to settle before sampling.

const resultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ready'),
    peak: z.object({
      count: z.number().int().nonnegative(),
      timeS: z.number().finite().nonnegative(),
      exceeded: z.boolean(),
    }),
  }),
  z.object({ kind: z.literal('error'), message: z.string() }),
]);
export type ParticleCheckResult = z.infer<typeof resultSchema>;

/** Measures the design in a worker; returns null while the current snapshot is still being measured. */
export function useParticleCheck(document: Design | null): ParticleCheckResult | null {
  const [result, setResult] = useState<{
    document: Design;
    value: ParticleCheckResult;
  } | null>(null);
  useEffect(() => {
    if (!document) return;
    let worker: Worker | null = null;
    const finish = (value: ParticleCheckResult) => {
      setResult({ document, value });
      worker?.terminate();
    };
    const timer = window.setTimeout(() => {
      try {
        worker = new Worker(new URL('./checks-worker.ts', import.meta.url));
      } catch {
        finish({ kind: 'error', message: 'Particle measurement could not start.' });
        return;
      }
      worker.onmessage = (event: MessageEvent<unknown>) => {
        const parsed = resultSchema.safeParse(event.data);
        finish(
          parsed.success
            ? parsed.data
            : { kind: 'error', message: 'Invalid particle measurement.' },
        );
      };
      worker.onerror = () => {
        finish({ kind: 'error', message: 'Particle measurement failed. Reload to retry.' });
      };
      worker.postMessage(document);
    }, MEASURE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [document]);
  return result !== null && result.document === document ? result.value : null;
}
