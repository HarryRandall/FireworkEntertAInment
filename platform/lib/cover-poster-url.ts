/**
 * Builds a public Supabase Storage URL for a pre-rendered cover poster path in
 * the `covers` bucket. The bucket is public-read so browse pages can render
 * cover <img> tags anonymously. Returns null when no path is supplied or the
 * Supabase URL is not configured, so callers fall back to the CSS gradient.
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';

export function coverPosterUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!SUPABASE_URL) return null;
  const base = SUPABASE_URL.replace(/\/+$/, '');
  const normalisedPath = path.replace(/^\/+/, '');
  return `${base}/storage/v1/object/public/covers/${normalisedPath}`;
}
