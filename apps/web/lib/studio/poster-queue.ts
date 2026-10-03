/** Sequential poster batches bound browser GPU and transport load to one version at a time. */
import type { PosterTask } from './render-posters';
/** A version's queue outcome; failed items remain eligible for a later retry. */
export interface PosterOutcome {
  id: string;
  status: 'ready' | 'failed';
  message: string;
}
/** Processes a fixed batch, continuing after failures and stopping between versions on cancellation. */
export async function runPosterQueue(
  tasks: readonly PosterTask[],
  render: (task: PosterTask) => Promise<void>,
  report: (outcome: PosterOutcome) => void,
  cancelled: () => boolean,
): Promise<void> {
  for (const task of tasks) {
    if (cancelled()) return;
    let outcome: PosterOutcome;
    try {
      await render(task);
      outcome = { id: task.id, status: 'ready', message: '' };
    } catch (failure) {
      outcome = {
        id: task.id,
        status: 'failed',
        message: failure instanceof Error ? failure.message : 'Poster rendering failed.',
      };
    }
    if (cancelled()) return;
    report(outcome);
  }
}
