/** Published playback follows the draft clock without a second independent transport. */
'use client';
import { useEffect, type RefObject } from 'react';
import type { Design } from '@showcrafter/fireworks';
import type { Viewer } from '@showcrafter/fireworks/view';
import { useStudioViewer } from './use-studio-viewer';

/** Mounts the immutable published document, seeking it in firing-relative seconds from the draft. */
export function ComparePreview({
  published,
  leader,
}: {
  published: { document: Design; number: number };
  leader: RefObject<Viewer | null>;
}) {
  const { container, viewer, failure } = useStudioViewer(published.document, false, null, false);
  useEffect(() => {
    const active = leader.current;
    if (!active) return;
    return active.on((value) => {
      viewer.current?.pause();
      viewer.current?.seek(value.t);
    });
  }, [leader, viewer]);
  return (
    <div className="sc-studio-pane" data-preview="published">
      <h2>Published · v{published.number}</h2>
      <div ref={container} className="absolute inset-0" aria-label="Published firework preview" />
      {failure !== '' && (
        <p role="alert" className="relative p-12">
          {failure}
        </p>
      )}
    </div>
  );
}
