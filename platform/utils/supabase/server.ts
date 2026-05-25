/** Server-side Supabase client bound to the current request cookies; call from Server Components, Route Handlers, and Server Actions. */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseServerEnv } from '@/utils/supabase/env';
import type { Database } from '@/lib/database.types';

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  const env = getSupabaseServerEnv();
  if (!env) {
    throw new Error(
      'Supabase URL and anon/publishable key are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local for dev, or in Vercel Project Settings → Environment Variables. Optional server-only fallbacks: SUPABASE_URL, SUPABASE_ANON_KEY.',
    );
  }

  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};
