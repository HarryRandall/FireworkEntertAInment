import 'server-only';

/** Service-role Supabase client that bypasses RLS; use only in trusted server code that has already been RBAC-gated upstream. */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { supabaseFetchLong } from '@/utils/supabase/fetch';

/**
 * Browserless Supabase client using the service role key.
 * Use only after normal permission checks; never expose the key to clients.
 */
export function createServiceRoleSupabase() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = rawUrl.replace(/\/+$/, '');
  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    global: { fetch: supabaseFetchLong },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
