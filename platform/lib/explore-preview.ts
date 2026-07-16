import type { ShowTemplateCue } from '@/lib/admin.types';
import type { FireworkSpecification } from '@/lib/show-domain';

export const EXPLORE_PREVIEW_INTENT_MS = 500;

export type ExplorePreviewPayload = {
  previewCues: ShowTemplateCue[];
  specifications: FireworkSpecification[];
};

/** Load one published template's replay data after explicit hover or focus intent. */
export async function loadExplorePreview(
  slug: string,
  signal: AbortSignal,
): Promise<ExplorePreviewPayload> {
  const response = await fetch(`/api/library/${encodeURIComponent(slug)}/preview`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error('Explore preview could not be loaded.');

  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { previewCues?: unknown }).previewCues) ||
    !Array.isArray((payload as { specifications?: unknown }).specifications)
  ) {
    throw new Error('Explore preview was malformed.');
  }
  return payload as ExplorePreviewPayload;
}
