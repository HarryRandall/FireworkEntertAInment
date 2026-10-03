/** Browser lifecycle coordination freezes conflicting edits and ignores stale UI completions. */
'use client';
import { useState } from 'react';
import { useStudioTask } from './use-studio-task';
import type { Design } from '@showcrafter/fireworks';
import type { StudioVersion } from '@/lib/studio/history-load';
import {
  finishStudioSession,
  restoreStudioSession,
  renderPublishedPosters,
} from '@/lib/studio/lifecycle-flow';

/** Coordinates the current draft with history previews and publication acknowledgements. */
export function useStudioLifecycle(input: {
  effectId: string;
  title: string;
  document: Design;
  sourceVersionId: string;
  versionNumber: number;
  settle: () => Promise<string | null>;
  published: { id: string; number: number; document: Design } | null;
}) {
  const { busy, error, run, isCurrent } = useStudioTask();
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<StudioVersion | null>(null);
  const session = {
    ...input,
    refresh: () => {
      // A new editor lifetime starts with the acknowledged lifecycle version, not an old autosave UUID.
      window.location.reload();
    },
    message: setMessage,
    isCurrent,
  };
  return {
    busy,
    error,
    message,
    preview,
    setPreview,
    finish: (operation: 'publish' | 'review', note: string) => {
      run(() => finishStudioSession(session, operation, note), true);
    },
    restore: (version: StudioVersion) => {
      run(() => restoreStudioSession(session, version), true);
    },
    retry: () => {
      const published = input.published;
      if (published)
        run(() =>
          renderPublishedPosters(session, {
            id: published.id,
            kind: 'effect',
            name: input.title,
            number: published.number,
            preview: { design: published.document },
          }),
        );
    },
  };
}
