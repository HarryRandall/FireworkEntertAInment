/** Each authored snapshot owns a cancellable off-thread measurement, never a stale pass. */
'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Design } from '@showcrafter/fireworks';
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
/** Measures the current snapshot in a worker and terminates obsolete work on edit or unmount. */
export function useStudioChecks(document: Design) {
  const [result, setResult] = useState<{
    document: Design;
    value: z.infer<typeof resultSchema>;
  } | null>(null);
  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./checks-worker.ts', import.meta.url));
    } catch {
      setResult({
        document,
        value: { kind: 'error', message: 'Particle measurement could not start.' },
      });
      return;
    }
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const parsed = resultSchema.safeParse(event.data);
      setResult({
        document,
        value: parsed.success
          ? parsed.data
          : { kind: 'error', message: 'Invalid particle measurement.' },
      });
      worker.terminate();
    };
    worker.onerror = () => {
      setResult({
        document,
        value: { kind: 'error', message: 'Particle measurement failed. Reload to retry.' },
      });
      worker.terminate();
    };
    worker.postMessage(document);
    return () => {
      worker.terminate();
    };
  }, [document]);
  return result?.document === document ? result.value : null;
}
