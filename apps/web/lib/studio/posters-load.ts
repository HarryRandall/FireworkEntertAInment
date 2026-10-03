/** Caller-RLS catalogue reads identify missing or stale effect and composed-product posters. */
import 'server-only';
import { getServerClient } from '@/lib/supabase/server-client';
import { loadCatalogue, previewProductVersion } from '@/lib/catalogue/loaders';
import { effectPreview } from '@/lib/catalogue/preview';
import { readRows } from '@/lib/catalogue/read';
import { needsPosters } from './poster-specs';
import type { PosterTask } from './render-posters';

/** Loads current published versions requiring one or more current-renderer formats. */
export async function loadPosterQueue(): Promise<PosterTask[]> {
  const data = await loadCatalogue();
  const client = await getServerClient();
  const records = await readRows((a, b) =>
    client
      .from('poster_renders')
      .select('effect_version_id,product_version_id,renderer,framing,status')
      .order('id')
      .range(a, b),
  );
  const tasks: PosterTask[] = [];
  for (const effect of data.effects.filter((row) => row.status === 'published')) {
    const version = data.effectVersions.find((row) => row.id === effect.current_version_id);
    if (version && needsPosters(records.filter((row) => row.effect_version_id === version.id)))
      tasks.push({
        id: version.id,
        kind: 'effect',
        name: effect.name,
        number: version.number,
        preview: effectPreview(version.design),
      });
  }
  for (const product of data.products.filter((row) => row.status === 'published')) {
    const version = data.productVersions.find((row) => row.id === product.current_version_id);
    if (!version || !needsPosters(records.filter((row) => row.product_version_id === version.id)))
      continue;
    const preview = previewProductVersion(data, version);
    if (preview)
      tasks.push({
        id: version.id,
        kind: 'product',
        name: product.name,
        number: version.number,
        preview,
      });
  }
  return tasks;
}
