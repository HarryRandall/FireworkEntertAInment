/**
 * Shared request-scoped Supabase client used by every admin server module.
 *
 * Wrapped in React's `cache()` so a single request reuses one client across
 * many server components — important because each `createClient` call reads
 * the cookie store.
 */
import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

/** Returns the request-scoped Supabase client (memoised per request). */
export const getServerClient = cache(async () => createClient(await cookies()));
