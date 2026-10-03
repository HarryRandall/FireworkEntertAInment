import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerEnv } from '@/lib/supabase/env';
import { supabaseFetch } from '@/lib/supabase/fetch';

/** Cookie-free public client for server probes that must not inherit a caller's session. */
export function createPublicServerSupabase() {
  const env = getSupabaseServerEnv();
  if (!env) return null;

  return createClient(env.url, env.key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { fetch: supabaseFetch },
  });
}
