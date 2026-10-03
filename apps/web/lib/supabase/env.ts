/** Resolves the Supabase URL/anon key from the various supported env-variable names. */

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function firstConfigured(values: readonly (string | undefined)[]): string {
  return values.find((value) => value !== undefined && value.length > 0) ?? '';
}
function environment(url: string, key: string): { url: string; key: string } | null {
  if (url.length === 0 || key.length === 0) return null;
  return { url: normalizeSupabaseUrl(url), key };
}
/** Resolves server/Edge URL and publishable key in the configured precedence order. */
export function getSupabaseServerEnv(): { url: string; key: string } | null {
  return environment(
    firstConfigured([
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
      process.env.SUPABASE_URL?.trim(),
    ]),
    firstConfigured([
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim(),
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
      process.env.SUPABASE_ANON_KEY?.trim(),
    ]),
  );
}
/** Resolves only statically named public variables available in a browser bundle. */
export function getSupabaseBrowserEnv(): { url: string; key: string } | null {
  return environment(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '',
    firstConfigured([
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    ]),
  );
}
