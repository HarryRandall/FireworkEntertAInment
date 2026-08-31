import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getSupabaseServerEnv } from '@/utils/supabase/env';
import { supabaseFetch } from '@/utils/supabase/fetch';

/** Cookie-free public client for server probes that must not inherit a caller's session. */
export function createPublicServerSupabase() {
  const env = getSupabaseServerEnv();
  if (!env) return null;

  return createClient<Database>(env.url, env.key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { fetch: supabaseFetch },
  });
}
