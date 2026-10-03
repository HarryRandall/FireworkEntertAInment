/** React binds authored documents to a serial autosave lifetime and unload protection. */
'use client';
import { useEffect, useRef, useState } from 'react';
import type { Design } from '@showcrafter/fireworks';
import { DraftAutosave, type SaveStatus } from '@/lib/studio/autosave';
import { saveStudio } from '@/lib/studio/save';

/** Autosaves committed snapshots; active drags remain unsaved until their single undo step commits. */
export function useDraftSave({
  document,
  gesture,
  effectId,
  versionId,
  sourceVersionId,
  editable,
}: {
  document: Design;
  gesture: Design | null;
  effectId: string;
  versionId: string | null;
  sourceVersionId: string;
  editable: boolean;
}) {
  // Server revalidation may return the newly created draft. The mounted editor owns
  // its acknowledgement and history until another effect is opened or the page reloads.
  const initial = useRef({ document, versionId, sourceVersionId, effectId });
  const controller = useRef<DraftAutosave | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ label: 'Saved', message: '' });
  useEffect(() => {
    const opened = initial.current;
    const autosave = new DraftAutosave(
      opened.document,
      opened.versionId,
      (next, draftId) =>
        saveStudio({
          effectId: opened.effectId,
          sourceVersionId: opened.sourceVersionId,
          versionId: draftId,
          document: next,
        }),
      setStatus,
    );
    controller.current = autosave;
    return () => {
      autosave.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    if (editable && !gesture) controller.current?.update(document);
  }, [document, editable, gesture]);
  const gestureChanged = gesture !== null && JSON.stringify(document) !== JSON.stringify(gesture);
  const dirty = gestureChanged || status.label !== 'Saved';
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', protect);
    return () => {
      window.removeEventListener('beforeunload', protect);
    };
  }, [dirty]);
  return {
    status: gestureChanged ? { label: 'Unsaved' as const, message: status.message } : status,
    save: () => {
      if (editable && !gesture) controller.current?.requestSave();
    },
  };
}
