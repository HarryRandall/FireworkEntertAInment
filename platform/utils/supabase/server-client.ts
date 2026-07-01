import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { supabaseFetchCatalogue } from '@/utils/supabase/fetch';
import { createClient } from '@/utils/supabase/server';

/**
 * Canonical request-scoped Supabase client for server code.
 *
 * Wrapped in React's `cache()` so a single request reuses one client across
 * every server component, route handler, and server action, no matter which
 * module asks. The domain helpers in `lib/shows/supabase` and
 * `lib/admin/supabase` re-export this so they share the same memoisation cell
 * (previously each module had its own `cache()` and a request that touched both
 * created two clients).
 */
export const getServerClient = cache(async () => createClient(await cookies()));

/** Longer-timeout client for nested catalogue reads that fan out across joins. */
export const getCatalogueReadClient = cache(async () =>
  createClient(await cookies(), supabaseFetchCatalogue),
);
