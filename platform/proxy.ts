import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerEnv } from '@/utils/supabase/env';

// Private route prefixes that require an authenticated session. Browse routes
// (/home, /catalogue, /library, /library/[id]) are intentionally public so
// guests can explore the catalogue and templates; /dashboard is also public
// because it only redirects to /home. Creation and account routes stay gated.
// Dev-only diagnostics are blocked in production before auth handling.
const PROTECTED_PREFIXES = ['/exports', '/shows', '/recommendations', '/admin', '/settings'];
const AUTH_ONLY_PATHS = ['/login', '/signup'];

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function copySupabaseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-showcrafter-user-id');

  const createSupabaseResponse = () =>
    NextResponse.next({
      request: { headers: requestHeaders },
    });

  let supabaseResponse = createSupabaseResponse();

  const { pathname } = request.nextUrl;

  if (pathname === '/dev' || pathname.startsWith('/dev/')) {
    if (process.env.NODE_ENV === 'development') {
      return supabaseResponse;
    }
    return NextResponse.rewrite(new URL('/404', request.url), { status: 404 });
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => matchesPathPrefix(pathname, p));
  const isAuthPage = AUTH_ONLY_PATHS.includes(pathname);
  const isRoot = pathname === '/';

  if (!isProtected && !isAuthPage && !isRoot) {
    return supabaseResponse;
  }

  const env = getSupabaseServerEnv();
  if (!env) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[proxy] Missing Supabase URL or key. Add NEXT_PUBLIC_SUPABASE_URL plus NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local. Auth gating disabled.',
      );
    }
    return supabaseResponse;
  }

  // Build a Supabase client that refreshes the session cookie on every request.
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = createSupabaseResponse();
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims.sub === 'string' ? data.claims.sub : null;

  if (userId) {
    requestHeaders.set('x-showcrafter-user-id', userId);
  }

  if (isProtected && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return copySupabaseCookies(supabaseResponse, NextResponse.redirect(url));
  }

  // Authenticated users skip the marketing surface: send them to the app
  // home page from auth-only pages and the public root.
  if ((isAuthPage || isRoot) && userId) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return copySupabaseCookies(supabaseResponse, NextResponse.redirect(url));
  }

  return copySupabaseCookies(supabaseResponse, createSupabaseResponse());
}

export const config = {
  // Match everything except Next internals, static assets, the auth callback,
  // and API routes (which handle their own auth).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|auth/callback).*)'],
};
