/**
 * Shared read-side contract for persisted firework browse-card images.
 *
 * Storage objects are immutable. The manifest revision is therefore also part
 * of the preview request URL, preventing an in-memory renderer capture from an
 * older visual source being reused after an editor save.
 */
// v2: posters captured at 1280x800 for high-density displays. Bumping the
// version invalidates the blurry 640x400 v1 posters so the admin backfill
// re-captures every card at the new resolution.
export const FIREWORK_PREVIEW_RENDERER_VERSION = 'v2';
export const FIREWORK_PREVIEW_BUCKET = 'firework-previews';

export type FireworkPreviewImageManifest = {
  source_revision: number;
  renderer_version: string | null;
  storage_path: string | null;
};

export type FireworkPreviewImageRelation =
  | FireworkPreviewImageManifest
  | FireworkPreviewImageManifest[]
  | null
  | undefined;

export type ResolvedFireworkPreviewImage = {
  previewImagePath: string | null;
  previewImageRevision: number | null;
};

function firstManifest(
  relation: FireworkPreviewImageRelation,
): FireworkPreviewImageManifest | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

export function resolveFireworkPreviewImage(
  relation: FireworkPreviewImageRelation,
): ResolvedFireworkPreviewImage {
  const manifest = firstManifest(relation);
  if (!manifest) {
    return { previewImagePath: null, previewImageRevision: null };
  }

  return {
    previewImagePath:
      manifest.renderer_version === FIREWORK_PREVIEW_RENDERER_VERSION
        ? manifest.storage_path
        : null,
    previewImageRevision: manifest.source_revision,
  };
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';

export function isCurrentFireworkPreviewImagePath(path: string | null | undefined): boolean {
  return Boolean(path?.startsWith(`${FIREWORK_PREVIEW_RENDERER_VERSION}/`));
}

export function fireworkPreviewImageUrl(path: string | null | undefined): string | null {
  if (!path || !isCurrentFireworkPreviewImagePath(path) || !SUPABASE_URL) return null;
  const base = SUPABASE_URL.replace(/\/+$/, '');
  const normalisedPath = path.replace(/^\/+/, '');
  return `${base}/storage/v1/object/public/${FIREWORK_PREVIEW_BUCKET}/${normalisedPath}`;
}

export function withFireworkPreviewRevision(
  previewUrl: string,
  revision: number | null | undefined,
): string {
  if (revision == null) return previewUrl;
  const separator = previewUrl.includes('?') ? '&' : '?';
  return `${previewUrl}${separator}revision=${encodeURIComponent(String(revision))}`;
}
