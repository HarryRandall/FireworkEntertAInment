/**
 * Request-scoped helpers for resolving the current authenticated user.
 *
 * Both helpers are wrapped in React's `cache()` so multiple server components
 * in the same request share a single Supabase auth lookup. {@link
 * getCurrentUserId} additionally honours the `x-showcrafter-user-id` header
 * set by the dev impersonation proxy ([proxy.ts](../proxy.ts)) so local
 * development can act as any user without re-logging-in.
 */
import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

/** Returns the Supabase Auth user object for the request, or `null` when unauthenticated. */
export const getCurrentUser = cache(async () => {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
});

/**
 * Returns the current user id, preferring (in order) the dev impersonation
 * header, the JWT `sub` claim, and finally a full `auth.getUser()` round-trip.
 *
 * The impersonation header short-circuit means local development never has to
 * pay the Supabase auth round-trip when the proxy already knows the user.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const proxiedUserId = (await headers()).get('x-showcrafter-user-id');
  if (proxiedUserId) {
    return proxiedUserId;
  }

  const supabase = createClient(await cookies());
  const { data } = await supabase.auth.getClaims();
  const claimsUserId = data?.claims.sub;
  if (typeof claimsUserId === 'string') {
    return claimsUserId;
  }

  const user = await getCurrentUser();
  return user?.id ?? null;
});
