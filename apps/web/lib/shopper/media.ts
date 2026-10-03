/** Public storage references are limited to the two public visual asset buckets. */
/** Builds a public visual-asset URL from an already validated storage path. */
export function publicVisualUrl(bucket: 'brand' | 'posters', path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  if (base === undefined || base.length === 0)
    throw new Error('Public storage environment is missing');
  return `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
