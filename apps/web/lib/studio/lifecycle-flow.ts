/** Browser workflow separates immutable publication from recoverable poster transport. */
import type { Design } from '@showcrafter/fireworks';
import type { StudioVersion } from './history-load';
import { finishStudio, restoreStudio } from './lifecycle';
import { POSTER_SPECS } from './poster-specs';
import { renderVersionPosters, type PosterTask } from './render-posters';
/** Current editor snapshot and lifecycle acknowledgements supplied by the React boundary. */
export interface StudioSession {
  effectId: string;
  title: string;
  document: Design;
  sourceVersionId: string;
  versionNumber: number;
  settle: () => Promise<string | null>;
  refresh: () => void;
  message: (value: string) => void;
  isCurrent: () => boolean;
}
/** Renders an already published snapshot; failures report missing posters and never undo publication. */
export async function renderPublishedPosters(
  session: StudioSession,
  task: PosterTask,
): Promise<void> {
  session.message('Rendering posters...');
  try {
    await renderVersionPosters(task, (count) => {
      if (session.isCurrent())
        session.message(
          `Rendering posters: ${String(count)} of ${String(POSTER_SPECS.length)} ready`,
        );
    });
    session.message('Published. All posters are ready.');
  } catch (failure) {
    console.error('Published version posters are missing', failure);
    session.message(
      'Version published. Posters are missing. Retry posters or use the Posters page.',
    );
  }
  if (session.isCurrent()) session.refresh();
}
/** Waits for acknowledged autosave, changes the exact draft lifecycle, then renders published stills. */
export async function finishStudioSession(
  session: StudioSession,
  operation: 'publish' | 'review',
  note: string,
): Promise<void> {
  const versionId = await session.settle();
  if (versionId === null) throw new Error('Make a change and save the draft before continuing.');
  if (!session.isCurrent()) return;
  const result = await finishStudio({
    effectId: session.effectId,
    versionId,
    document: session.document,
    note,
    operation,
  });
  if (result.kind === 'error') throw new Error(result.message);
  if (operation === 'publish')
    await renderPublishedPosters(session, {
      id: result.versionId,
      kind: 'effect',
      name: session.title,
      number: session.versionNumber,
      preview: { design: session.document },
    });
  else if (session.isCurrent()) {
    session.message('Sent for review. Editing is paused.');
    session.refresh();
  }
}
/** Restores saved history only after the authored current document has finished saving. */
export async function restoreStudioSession(
  session: StudioSession,
  version: StudioVersion,
): Promise<void> {
  const acknowledged = await session.settle();
  if (!session.isCurrent()) return;
  const result = await restoreStudio({
    effectId: session.effectId,
    versionId: version.id,
    currentVersionId: acknowledged ?? session.sourceVersionId,
    document: session.document,
  });
  if (result.kind === 'error') throw new Error(result.message);
  session.refresh();
}
