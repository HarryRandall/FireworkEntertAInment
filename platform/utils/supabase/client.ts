/** Browser-side Supabase client factory (uses the publishable anon key); call from Client Components. */

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseBrowserEnv } from '@/utils/supabase/env';
import type { Database } from '@/lib/database.types';

export const createClient = () => {
  const env = getSupabaseBrowserEnv();
  if (!env) {
    throw new Error(
      'Supabase browser client: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY (must be NEXT_PUBLIC_* for the browser).',
    );
  }
  return createBrowserClient<Database>(env.url, env.key);
};
