import { AuthClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  clearSupabaseAuthCookies,
  copySupabaseCookies,
  decodeStorageCookie,
  getSupabaseAuthCookieName,
  getSupabaseRelatedAuthCookieNames,
  hasSupabaseSessionCookie,
  readChunkedCookie,
  removeStorageCookie,
  setStorageCookie,
} from '@/lib/auth/proxy-cookies';
import { isStaleSupabaseAuthError } from '@/lib/auth/proxy-errors';
import { AUTH_ONLY_PATHS, matchesPathPrefix, PROTECTED_PREFIXES } from '@/lib/auth/proxy-routes';
import { importRenderContentSecurityPolicy } from '@/lib/security/import-render-csp';
import { getSupabaseServerEnv } from '@/utils/supabase/env';
import { supabaseFetch } from '@/utils/supabase/fetch';

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-showcrafter-user-id');

  const createSupabaseResponse = () =>
    NextResponse.next({
      request: { headers: requestHeaders },
    });

  const { pathname } = request.nextUrl;
  if (pathname === '/internal/import-render') {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const contentSecurityPolicy = importRenderContentSecurityPolicy(nonce);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
    const response = createSupabaseResponse();
    response.headers.set('Content-Security-Policy', contentSecurityPolicy);
    response.headers.set('X-Frame-Options', 'DENY');
    return response;
  }

  let supabaseResponse = createSupabaseResponse();

  const isProtected = PROTECTED_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
  const isAuthPage = AUTH_ONLY_PATHS.includes(pathname as (typeof AUTH_ONLY_PATHS)[number]);
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

  let userId: string | null = null;
  if (hasSupabaseSessionCookie(request, env.url)) {
    const storageKey = getSupabaseAuthCookieName(env.url);
    const initialAuthCookieNames = getSupabaseRelatedAuthCookieNames(request, env.url);
    const auth = new AuthClient({
      url: `${env.url}/auth/v1`,
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        'X-Client-Info': 'showcrafter-proxy',
      },
      storageKey,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      fetch: supabaseFetch,
      skipAutoInitialize: true,
      storage: {
        getItem(key) {
          const value = readChunkedCookie(request, key);
          return value ? decodeStorageCookie(value) : null;
        },
        setItem(key, value) {
          supabaseResponse = createSupabaseResponse();
          setStorageCookie(request, requestHeaders, supabaseResponse, key, value);
        },
        removeItem(key) {
          supabaseResponse = createSupabaseResponse();
          removeStorageCookie(request, requestHeaders, supabaseResponse, key);
        },
      },
    });

    try {
      const { data, error } = await auth.getClaims();
      if (error) {
        if (!isStaleSupabaseAuthError(error)) throw error;
        supabaseResponse = clearSupabaseAuthCookies(
          request,
          requestHeaders,
          createSupabaseResponse,
          env.url,
          initialAuthCookieNames,
        );
      } else {
        userId = typeof data?.claims.sub === 'string' ? data.claims.sub : null;
      }
    } catch (error) {
      if (!isStaleSupabaseAuthError(error)) throw error;
      supabaseResponse = clearSupabaseAuthCookies(
        request,
        requestHeaders,
        createSupabaseResponse,
        env.url,
        initialAuthCookieNames,
      );
    }
  }

  if (userId) {
    requestHeaders.set('x-showcrafter-user-id', userId);
  }

  if (isProtected && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return copySupabaseCookies(supabaseResponse, NextResponse.redirect(url));
  }

  if ((isAuthPage || isRoot) && userId) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return copySupabaseCookies(supabaseResponse, NextResponse.redirect(url));
  }

  return copySupabaseCookies(supabaseResponse, createSupabaseResponse());
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|api/|auth/callback).*)'],
};
