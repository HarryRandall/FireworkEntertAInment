/** Request-scoped auth lookups shared through React cache. */
import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';
import { getServerClient } from '@/lib/supabase/server-client';

/** Returns the Supabase Auth user object for the request, or `null` when unauthenticated. */
export const getCurrentUser = cache(async () => {
  const supabase = await getServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
});

/** The proxy strips incoming user-id headers and forwards only a verified identity. */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const proxiedUserId = (await headers()).get('x-showcrafter-user-id');
  if (proxiedUserId) {
    return proxiedUserId;
  }

  const supabase = await getServerClient();
  const { data } = await supabase.auth.getClaims();
  const claimsUserId = data?.claims.sub;
  if (typeof claimsUserId === 'string') {
    return claimsUserId;
  }

  const user = await getCurrentUser();
  return user?.id ?? null;
});
