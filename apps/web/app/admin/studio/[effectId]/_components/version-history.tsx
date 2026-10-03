/** Immutable history previews are separate from the current reducer and autosave document. */
import { designChanges } from '@/lib/studio/diff';
import type { StudioVersion } from '@/lib/studio/history-load';
import { Modal } from '@/ui/kit/overlays';
import { Button } from '@/ui/primitives/button';
import { DesignChangeList } from './design-change-list';

/** Lists newest snapshots first and explains each against its preceding version. */
export function VersionHistory({
  versions,
  currentId,
  open,
  busy,
  editable,
  onOpenChange,
  onPreview,
  onRestore,
}: {
  versions: StudioVersion[];
  currentId: string;
  open: boolean;
  busy: boolean;
  editable: boolean;
  onOpenChange: (open: boolean) => void;
  onPreview: (version: StudioVersion) => void;
  onRestore: (version: StudioVersion) => void;
}) {
  return (
    <Modal
      title="Version history"
      description="Preview saved designs. Restoring keeps your current work as its own version."
      side
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <ol className="grid gap-5">
        {versions.map((version, index) => (
          <li key={version.id} className="border-border grid gap-2 border-b pb-5">
            <h2 className="font-semibold">
              Version {version.number} · {version.status}
              {version.id === currentId ? ' · Current' : ''}
            </h2>
            <p className="text-muted-foreground text-sm">
              {version.author} · {new Date(version.created).toLocaleString('en-GB')}
            </p>
            {version.note !== null && version.note !== '' && (
              <p className="text-sm">{version.note}</p>
            )}
            {index + 1 < versions.length ? (
              <details>
                <summary className="cursor-pointer text-sm">
                  Changes from the previous version
                </summary>
                <DesignChangeList
                  changes={designChanges(versions[index + 1].document, version.document)}
                />
              </details>
            ) : (
              <p className="text-muted-foreground text-sm">First version</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  onPreview(version);
                  onOpenChange(false);
                }}
              >
                Preview version {version.number}
              </Button>
              <Button
                variant="outline"
                disabled={busy || !editable}
                onClick={() => {
                  onRestore(version);
                }}
              >
                Restore version {version.number}
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
