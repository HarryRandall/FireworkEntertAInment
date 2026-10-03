/** Browser-only poster transport keeps publication independent of WebGL and upload failures. */
import { RENDERER_VERSION } from '@showcrafter/fireworks';
import { poster, developedTime } from '@showcrafter/fireworks/view';
import { createClient } from '@/lib/supabase/client';
import type { CataloguePreview } from '@/lib/catalogue/types';
import { POSTER_SPECS } from './poster-specs';

const MS_PER_SECOND = 1000; // Stored capture clocks use milliseconds from the first firing.
/** A persisted catalogue version and its validated browser rendering input. */
export interface PosterTask {
  id: string;
  kind: 'effect' | 'product';
  name: string;
  number: number;
  preview: CataloguePreview;
}
type Client = ReturnType<typeof createClient>;
type Metadata = {
  effect_version_id: string | null;
  product_version_id: string | null;
  renderer: string;
  framing: string;
  width: number;
  height: number;
  t_ms: number;
  path: string;
};
function metadataFor(
  task: PosterTask,
  spec: (typeof POSTER_SPECS)[number],
  timeS: number,
): Metadata {
  return {
    effect_version_id: task.kind === 'effect' ? task.id : null,
    product_version_id: task.kind === 'product' ? task.id : null,
    renderer: RENDERER_VERSION,
    ...spec,
    t_ms: Math.round(timeS * MS_PER_SECOND),
    path: `${task.id}/${RENDERER_VERSION}/${spec.framing}.png`,
  };
}
async function captureAndUpload(
  client: Client,
  task: PosterTask,
  metadata: Metadata,
  timeS: number,
) {
  await writeStatus(client, metadata, 'pending');
  const blob = await poster(null, task.preview.design, {
    width: metadata.width,
    height: metadata.height,
    shots: task.preview.shots,
    prop: task.kind === 'product' ? 'cake' : 'mortar',
    t: timeS,
  });
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  const uploaded = await client.storage
    .from('posters')
    .upload(metadata.path, blob, { contentType: 'image/png', upsert: true });
  if (uploaded.error) throw uploaded.error;
  await writeStatus(client, { ...metadata, ...size }, 'ready');
}
function failureMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message;
  return 'Poster rendering or upload failed';
}
async function renderFormat(
  client: Client,
  task: PosterTask,
  metadata: Metadata,
  timeS: number,
): Promise<string | null> {
  try {
    await captureAndUpload(client, task, metadata, timeS);
    return null;
  } catch (error) {
    console.error('Poster rendering or upload failed', error);
    const reason = failureMessage(error);
    try {
      await writeStatus(client, metadata, 'failed');
    } catch (recordError) {
      console.error('Poster failure could not be recorded', recordError);
    }
    return `${metadata.framing}: ${reason}`;
  }
}
/** Renders all formats sequentially through the shared context; failures never undo publication.
 * Captures firing-relative seconds and records actual PNG dimensions, accounting for browser DPR.
 */
export async function renderVersionPosters(
  task: PosterTask,
  progress: (completed: number) => void = () => {},
): Promise<void> {
  const client = createClient();
  const timeS = (task.preview.shots?.[0]?.t0 ?? 0) + developedTime(task.preview.design);
  let completed = 0;
  const failures: string[] = [];
  for (const spec of POSTER_SPECS) {
    const failure = await renderFormat(client, task, metadataFor(task, spec, timeS), timeS);
    if (failure !== null) failures.push(failure);
    else {
      completed += 1;
      progress(completed);
    }
  }
  if (failures.length > 0) throw new Error(failures.join('; '));
}
async function writeStatus(
  client: Client,
  metadata: Metadata,
  status: 'pending' | 'ready' | 'failed',
) {
  const result = await client
    .from('poster_renders')
    .upsert(
      { ...metadata, status },
      { onConflict: 'effect_version_id,product_version_id,renderer,framing' },
    );
  if (result.error) throw result.error;
}
