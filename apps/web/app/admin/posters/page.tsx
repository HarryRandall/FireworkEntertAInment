/** Staff-only browser poster maintenance lives in the existing admin workspace. */
import { requireArea } from '@/lib/auth/server';
import { loadPosterQueue } from '@/lib/studio/posters-load';
import { PosterQueue } from './_components/poster-queue';

/** Lists published versions missing current-renderer formats; writes still require editor authority. */
export default async function Page() {
  const identity = await requireArea('admin');
  return (
    <div className="grid min-w-0 gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Posters</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Render missing and stale catalogue posters in this browser.
        </p>
      </header>
      <PosterQueue
        tasks={await loadPosterQueue()}
        editable={['super_admin', 'catalogue_editor'].includes(identity.access.staffRole ?? '')}
      />
    </div>
  );
}
