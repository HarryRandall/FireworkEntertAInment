/** Refreshes request cookies and establishes anonymous identities on public shopper visits. */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';
import { getSupabaseServerEnv } from '@/lib/supabase/env';

/** Persists Auth cookie changes on both the forwarded request and outgoing response. */
export async function proxy(request: NextRequest) {
  const env = getSupabaseServerEnv();
  if (!env) throw new Error('Supabase environment is missing');
  let response = NextResponse.next({ request });
  const client = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        for (const cookie of cookies) request.cookies.set(cookie.name, cookie.value);
        response = NextResponse.next({ request });
        for (const cookie of cookies)
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        response.headers.set('Cache-Control', 'private, no-store');
      },
    },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  const shopper =
    request.nextUrl.pathname === '/shopper' ||
    request.nextUrl.pathname.startsWith('/shopper/') ||
    request.nextUrl.pathname.startsWith('/q/');
  if (!user && shopper && request.method === 'GET') {
    const result = await client.auth.signInAnonymously();
    if (result.error) throw result.error;
  }
  return response;
}
/** Limits session work to auth and guarded or public shopper routes. */
export const config = {
  matcher: [
    '/auth/:path*',
    '/retailer/:path*',
    '/admin/:path*',
    '/supplier/:path*',
    '/account/:path*',
    '/shopper/:path*',
    '/q/:path*',
  ],
};
