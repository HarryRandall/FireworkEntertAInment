import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getSupabaseServerEnv } from '@/utils/supabase/env';
import { supabaseFetch } from '@/utils/supabase/fetch';

/**
 * Send recovery mail without browser PKCE state. The checked-in hosted email
 * template carries Supabase's recovery-only token hash to `/auth/confirm`.
 */
export async function sendPasswordRecoveryEmail(email: string, appOrigin: string) {
  const env = getSupabaseServerEnv();
  if (!env) return { ok: false as const, error: 'Supabase is not configured.' };

  try {
    const supabase = createClient<Database>(env.url, env.key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'implicit',
        persistSession: false,
      },
      global: { fetch: supabaseFetch },
    });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appOrigin,
    });

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Password recovery request failed.',
    };
  }
}
