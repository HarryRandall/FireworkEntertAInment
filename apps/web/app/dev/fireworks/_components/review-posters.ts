/** Progressive, cancellable catalogue stills on one reusable thumbnail surface. */
import type { PosterRenderer } from '@showcrafter/fireworks/view';
import { reviewTime } from '@showcrafter/fireworks/view';
import { entries } from './review-catalogue';
import type { ReviewSetters } from './review-viewer-lifecycle';

// Retry live ownership about once per 60 Hz display interval, in wall-clock milliseconds.
const LIVE_RETRY_MS = 16;

/** Starts after a task yield; owns the thumbnail renderer and all published blob URLs until teardown. */
export function mountPosters(
  setPosters: ReviewSetters['setPosters'],
  setError: ReviewSetters['setError'],
  createPosters: () => Pick<PosterRenderer, 'capture' | 'dispose'>,
  liveDrawPending: () => boolean,
): () => void {
  const cancellation = new AbortController();
  let renderer: Pick<PosterRenderer, 'capture' | 'dispose'> | null = null;
  const urls: string[] = [];
  const isCancelled = () => cancellation.signal.aborted;
  async function prepare() {
    // Let React commit readiness and the browser service input before any thumbnail work.
    await yieldTask();
    if (isCancelled()) return;
    for (const entry of entries) {
      // Never start another synchronous simulation/readback ahead of a queued live draw.
      while (liveDrawPending() && !isCancelled()) await yieldTask(LIVE_RETRY_MS);
      if (isCancelled()) return;
      renderer ??= createPosters();
      const blob = await renderer.capture(entry.design, reviewTime(entry.design));
      if (isCancelled()) return;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      setPosters((previous) => ({ ...previous, [entry.key]: url }));
      await yieldTask();
    }
  }
  prepare()
    .catch((cause: unknown) => {
      if (!isCancelled()) {
        const message = cause instanceof Error ? cause.message : 'PNG capture failed';
        setError(`Thumbnail preparation failed: ${message}`);
      }
    })
    .finally(() => {
      renderer?.dispose();
      renderer = null;
    })
    .catch((cause: unknown) => {
      console.error('Thumbnail cleanup failed', cause);
    });
  return () => {
    cancellation.abort();
    renderer?.dispose();
    renderer = null;
    for (const url of urls) URL.revokeObjectURL(url);
  };
}

function yieldTask(delay_ms = 0): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delay_ms);
  });
}
