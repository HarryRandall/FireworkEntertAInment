/** Publish actions, history preview banners and missing-poster retries sit above authored panels. */
import type { Design } from '@showcrafter/fireworks';
import type { CatalogueUsage } from '@/lib/catalogue/types';
import type { useVersionHistory } from './use-version-history';
import { Button } from '@/ui/primitives/button';
import { PublishReview } from './publish-review';
import { VersionHistory } from './version-history';
import type { useStudioLifecycle } from './use-studio-lifecycle';

/** Presents lifecycle failures separately from successful publication and unfinished posters. */
export function StudioLifecycle({
  state,
  document,
  published,
  title,
  number,
  editable,
  missingPosters,
  versions,
  usage,
  currentId,
}: {
  state: ReturnType<typeof useStudioLifecycle>;
  document: Design;
  published: Design | null;
  title: string;
  number: number;
  editable: boolean;
  missingPosters: boolean;
  versions: ReturnType<typeof useVersionHistory>;
  usage: CatalogueUsage[];
  currentId: string;
}) {
  return (
    <section aria-label="Publication and history" className="border-border grid gap-3 border-b p-4">
      {editable && !state.preview && (
        <div className="flex flex-wrap gap-2">
          <PublishReview
            document={document}
            published={published}
            title={title}
            number={number}
            usage={usage}
            busy={state.busy}
            error={state.error}
            onFinish={state.finish}
          />
        </div>
      )}
      {state.message !== '' && <p role="status">{state.message}</p>}
      {versions.error !== '' && <p role="alert">{versions.error}</p>}
      {state.error !== '' && <p role="alert">{state.error}</p>}
      {missingPosters && (
        <div className="flex flex-wrap items-center gap-2">
          <p>Published version posters are missing or stale.</p>
          <Button variant="outline" disabled={!editable || state.busy} onClick={state.retry}>
            Retry posters
          </Button>
        </div>
      )}
      {state.preview && (
        <div
          className="bg-accent text-accent-foreground flex flex-wrap items-center gap-2 rounded-lg p-3"
          role="status"
        >
          <p className="min-w-0 flex-1">
            Previewing version {state.preview.number}. Editing is paused.
          </p>
          <Button
            variant="outline"
            disabled={state.busy}
            onClick={() => {
              state.setPreview(null);
            }}
          >
            Back to current
          </Button>
          <Button
            disabled={!editable || state.busy}
            onClick={() => {
              if (state.preview) state.restore(state.preview);
            }}
          >
            Restore this version
          </Button>
        </div>
      )}
      <VersionHistory
        versions={versions.data.versions}
        currentId={currentId}
        open={versions.open}
        busy={state.busy}
        editable={editable}
        onOpenChange={versions.setOpen}
        onPreview={state.setPreview}
        onRestore={state.restore}
      />
    </section>
  );
}
