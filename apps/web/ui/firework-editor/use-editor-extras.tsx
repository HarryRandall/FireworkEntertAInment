/** Shared editor extras: reference clip, particle budget check, local draft autosave and library parts. */
'use client';
import type { Design } from '@showcrafter/renderer';
import type { SavedPart } from '@/lib/renderer-editor/library';
import type { DraftSnapshot } from '@/lib/admin/draft-autosave';
import { draftStorageKey } from '@/lib/admin/draft-autosave';
import { Button } from '@/ui/patterns/Button';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { ChecksBadge, particleCheckBlocks } from './renderer-design/checks-panel';
import { useReferenceClip } from './renderer-design/reference-panel';
import type { DesignExtras } from './renderer-design/tabs';
import { useParticleCheck } from './renderer-design/use-particle-check';
import { useDraftAutosave } from './use-draft-autosave';

const SAVED_AT_FORMAT = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Connects the extras to one editor; the editor keeps ownership of its fields and saving. */
export function useEditorExtras<T extends DraftSnapshot>({
  kind,
  design,
  libraryParts,
  snapshot,
  dirty,
  baseUpdatedAt,
  restore,
  onOpenChecks,
}: {
  kind: 'effect' | 'firework';
  design: Design | null;
  libraryParts: readonly SavedPart[];
  snapshot: T;
  dirty: boolean;
  baseUpdatedAt: string;
  restore: (value: T) => void;
  onOpenChecks: () => void;
}) {
  const reference = useReferenceClip();
  const particleCheck = useParticleCheck(design);
  const autosave = useDraftAutosave({
    storageKey: draftStorageKey(kind, snapshot.id),
    value: snapshot,
    dirty,
    baseUpdatedAt,
    restore,
  });
  const recovered = autosave.recovered;
  const designExtras: DesignExtras = { libraryParts, reference, particleCheck };
  return {
    designExtras,
    referenceClip: reference.clip,
    saveBlocked: design !== null && particleCheckBlocks(particleCheck),
    status: (
      <>
        {design && <ChecksBadge document={design} result={particleCheck} onOpen={onOpenChecks} />}
        {dirty && autosave.status === 'kept' && (
          <span className="text-muted-foreground text-xs">Draft kept on this device</span>
        )}
        {dirty && autosave.status === 'unavailable' && (
          <span className="text-status-warning text-xs">This browser cannot keep a draft</span>
        )}
      </>
    ),
    notice: recovered && (
      <InlineAlert tone="info" title="Unsaved draft found" className="mb-4">
        <p>
          Edits from {SAVED_AT_FORMAT.format(new Date(recovered.savedAt))} were not saved.
          {recovered.stale &&
            ' This record has been saved since, so restoring replaces those changes.'}
        </p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={recovered.restore}>
            Restore draft
          </Button>
          <Button size="sm" variant="ghost" onClick={recovered.discard}>
            Discard
          </Button>
        </div>
      </InlineAlert>
    ),
  };
}
