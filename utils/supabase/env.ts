function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Resolve Supabase URL + anon/publishable key for server / Edge (middleware).
 * Accepts names people often set in Vercel or from older Supabase docs.
 */
export function getSupabaseServerEnv(): { url: string; key: string } | null {
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    "";

  const url = rawUrl ? normalizeSupabaseUrl(rawUrl) : "";

  if (!url || !key) return null;
  return { url, key };
}

/**
 * Browser client: only NEXT_PUBLIC_* is available in the bundle.
 */
export function getSupabaseBrowserEnv(): { url: string; key: string } | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const url = raw ? normalizeSupabaseUrl(raw) : "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  if (!url || !key) return null;
  return { url, key };
}
