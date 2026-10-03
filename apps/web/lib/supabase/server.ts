/** Server-side Supabase client bound to the current request cookies; call from Server Components, Route Handlers, and Server Actions. */

import { createServerClient } from '@supabase/ssr';
import { type cookies } from 'next/headers';
import { getSupabaseServerEnv } from '@/lib/supabase/env';
import { supabaseFetch } from '@/lib/supabase/fetch';

/** Creates a request cookie-bound server client with the supplied fetch boundary. */
export const createClient = (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  fetchImpl: typeof fetch = supabaseFetch,
) => {
  const env = getSupabaseServerEnv();
  if (!env) {
    throw new Error(
      'Supabase URL and anon/publishable key are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local for dev, or in Vercel Project Settings > Environment Variables. Optional server-only fallbacks: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY.',
    );
  }

  return createServerClient(env.url, env.key, {
    global: { fetch: fetchImpl },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('Cookies can only be modified'))
            throw error;
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};
