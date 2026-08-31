import { AuthClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerEnv } from '@/utils/supabase/env';
import { supabaseFetch } from '@/utils/supabase/fetch';

// Private route prefixes that require an authenticated session; unauthenticated
// users are sent to /login with a next= round-trip.
const PROTECTED_PREFIXES = [
  '/exports',
  '/shows',
  '/recommendations',
  '/admin',
  '/settings',
  '/home',
  '/dashboard',
];
const AUTH_ONLY_PATHS = ['/login', '/signup'];
const STALE_AUTH_ERROR_CODES = new Set([
  'bad_jwt',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
]);
const EXPIRED_COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  httpOnly: false,
  maxAge: 0,
};
const SESSION_COOKIE_OPTIONS = {
  ...EXPIRED_COOKIE_OPTIONS,
  maxAge: 400 * 24 * 60 * 60,
};
const SUPABASE_COOKIE_CHUNK_SIZE = 3180;
const BASE64_PREFIX = 'base64-';

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function copySupabaseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

function syncRequestCookieHeader(request: NextRequest, requestHeaders: Headers) {
  const cookieHeader = request.cookies.toString();
  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader);
  } else {
    requestHeaders.delete('cookie');
  }
}

function getSupabaseAuthCookieName(supabaseUrl: string) {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

function isSupabaseSessionCookieName(name: string, authCookieName: string) {
  return name === authCookieName || name.startsWith(`${authCookieName}.`);
}

function isSupabaseRelatedAuthCookieName(name: string, authCookieName: string) {
  return [authCookieName, `${authCookieName}-code-verifier`, `${authCookieName}-user`].some(
    (key) => name === key || name.startsWith(`${key}.`),
  );
}

function getSupabaseRelatedAuthCookieNames(request: NextRequest, supabaseUrl: string) {
  const authCookieName = getSupabaseAuthCookieName(supabaseUrl);
  return request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => isSupabaseRelatedAuthCookieName(name, authCookieName));
}

function getCookieChunkNames(request: NextRequest, key: string) {
  return request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name === key || name.startsWith(`${key}.`));
}

function readChunkedCookie(request: NextRequest, key: string) {
  const directValue = request.cookies.get(key)?.value;
  if (directValue) return directValue;

  const chunks: string[] = [];
  for (let index = 0; ; index += 1) {
    const value = request.cookies.get(`${key}.${index}`)?.value;
    if (!value) break;
    chunks.push(value);
  }
  return chunks.length > 0 ? chunks.join('') : null;
}

function createCookieChunks(key: string, value: string) {
  let encodedValue = encodeURIComponent(value);
  if (encodedValue.length <= SUPABASE_COOKIE_CHUNK_SIZE) {
    return [{ name: key, value }];
  }

  const chunks: string[] = [];
  while (encodedValue.length > 0) {
    let encodedHead = encodedValue.slice(0, SUPABASE_COOKIE_CHUNK_SIZE);
    const lastEscape = encodedHead.lastIndexOf('%');
    if (lastEscape > SUPABASE_COOKIE_CHUNK_SIZE - 3) {
      encodedHead = encodedHead.slice(0, lastEscape);
    }

    let valueHead = '';
    while (encodedHead.length > 0) {
      try {
        valueHead = decodeURIComponent(encodedHead);
        break;
      } catch (error) {
        if (error instanceof URIError && encodedHead.at(-3) === '%' && encodedHead.length > 3) {
          encodedHead = encodedHead.slice(0, encodedHead.length - 3);
        } else {
          throw error;
        }
      }
    }

    chunks.push(valueHead);
    encodedValue = encodedValue.slice(encodedHead.length);
  }

  return chunks.map((chunk, index) => ({ name: `${key}.${index}`, value: chunk }));
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeStorageCookie(value: string) {
  return value.startsWith(BASE64_PREFIX)
    ? base64UrlDecode(value.slice(BASE64_PREFIX.length))
    : value;
}

function encodeStorageCookie(value: string) {
  return `${BASE64_PREFIX}${base64UrlEncode(value)}`;
}

function setStorageCookie(
  request: NextRequest,
  requestHeaders: Headers,
  response: NextResponse,
  key: string,
  value: string,
) {
  const chunks = createCookieChunks(key, encodeStorageCookie(value));
  const nextNames = new Set(chunks.map((chunk) => chunk.name));
  const existingNames = getCookieChunkNames(request, key);

  existingNames
    .filter((name) => !nextNames.has(name))
    .forEach((name) => {
      request.cookies.delete(name);
      response.cookies.set(name, '', EXPIRED_COOKIE_OPTIONS);
    });

  chunks.forEach(({ name, value: chunkValue }) => {
    request.cookies.set(name, chunkValue);
    response.cookies.set(name, chunkValue, SESSION_COOKIE_OPTIONS);
  });
  syncRequestCookieHeader(request, requestHeaders);
}

function removeStorageCookie(
  request: NextRequest,
  requestHeaders: Headers,
  response: NextResponse,
  key: string,
) {
  getCookieChunkNames(request, key).forEach((name) => {
    request.cookies.delete(name);
    response.cookies.set(name, '', EXPIRED_COOKIE_OPTIONS);
  });
  syncRequestCookieHeader(request, requestHeaders);
}

function hasSupabaseSessionCookie(request: NextRequest, supabaseUrl: string) {
  const authCookieName = getSupabaseAuthCookieName(supabaseUrl);
  return request.cookies
    .getAll()
    .some((cookie) => isSupabaseSessionCookieName(cookie.name, authCookieName));
}

function clearSupabaseAuthCookies(
  request: NextRequest,
  requestHeaders: Headers,
  createResponse: () => NextResponse,
  supabaseUrl: string,
  cookieNamesToClear = getSupabaseRelatedAuthCookieNames(request, supabaseUrl),
) {
  cookieNamesToClear.forEach((name) => request.cookies.delete(name));
  syncRequestCookieHeader(request, requestHeaders);

  const response = createResponse();
  cookieNamesToClear.forEach((name) => response.cookies.set(name, '', EXPIRED_COOKIE_OPTIONS));
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStaleSupabaseAuthError(error: unknown) {
  if (!isRecord(error)) return false;

  const code = typeof error.code === 'string' ? error.code : null;
  if (code && STALE_AUTH_ERROR_CODES.has(code)) return true;

  const status = typeof error.status === 'number' ? error.status : null;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    status === 400 &&
    (message.includes('invalid refresh token') || message.includes('refresh token is not valid'))
  );
}

function importRenderContentSecurityPolicy(nonce: string): string {
  const developmentScript = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  const developmentConnect = process.env.NODE_ENV === 'development' ? ' ws: wss:' : '';
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScript}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${developmentConnect}`,
    "worker-src 'self' blob:",
    "manifest-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

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
  matcher: ['/((?!_next/|favicon.ico|api/|auth/callback).*)'],
};
