import { type NextRequest, NextResponse } from 'next/server';

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

export function copySupabaseCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

function syncRequestCookieHeader(request: NextRequest, requestHeaders: Headers): void {
  const cookieHeader = request.cookies.toString();
  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader);
  } else {
    requestHeaders.delete('cookie');
  }
}

export function getSupabaseAuthCookieName(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

function isSupabaseSessionCookieName(name: string, authCookieName: string): boolean {
  return name === authCookieName || name.startsWith(`${authCookieName}.`);
}

function isSupabaseRelatedAuthCookieName(name: string, authCookieName: string): boolean {
  return [authCookieName, `${authCookieName}-code-verifier`, `${authCookieName}-user`].some(
    (key) => name === key || name.startsWith(`${key}.`),
  );
}

export function getSupabaseRelatedAuthCookieNames(
  request: NextRequest,
  supabaseUrl: string,
): string[] {
  const authCookieName = getSupabaseAuthCookieName(supabaseUrl);
  return request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => isSupabaseRelatedAuthCookieName(name, authCookieName));
}

function getCookieChunkNames(request: NextRequest, key: string): string[] {
  return request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name === key || name.startsWith(`${key}.`));
}

export function readChunkedCookie(request: NextRequest, key: string): string | null {
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

function createCookieChunks(key: string, value: string): Array<{ name: string; value: string }> {
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

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeStorageCookie(value: string): string {
  return value.startsWith(BASE64_PREFIX)
    ? base64UrlDecode(value.slice(BASE64_PREFIX.length))
    : value;
}

function encodeStorageCookie(value: string): string {
  return `${BASE64_PREFIX}${base64UrlEncode(value)}`;
}

export function setStorageCookie(
  request: NextRequest,
  requestHeaders: Headers,
  response: NextResponse,
  key: string,
  value: string,
): void {
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

export function removeStorageCookie(
  request: NextRequest,
  requestHeaders: Headers,
  response: NextResponse,
  key: string,
): void {
  getCookieChunkNames(request, key).forEach((name) => {
    request.cookies.delete(name);
    response.cookies.set(name, '', EXPIRED_COOKIE_OPTIONS);
  });
  syncRequestCookieHeader(request, requestHeaders);
}

export function hasSupabaseSessionCookie(request: NextRequest, supabaseUrl: string): boolean {
  const authCookieName = getSupabaseAuthCookieName(supabaseUrl);
  return request.cookies
    .getAll()
    .some((cookie) => isSupabaseSessionCookieName(cookie.name, authCookieName));
}

export function clearSupabaseAuthCookies(
  request: NextRequest,
  requestHeaders: Headers,
  createResponse: () => NextResponse,
  supabaseUrl: string,
  cookieNamesToClear = getSupabaseRelatedAuthCookieNames(request, supabaseUrl),
): NextResponse {
  cookieNamesToClear.forEach((name) => request.cookies.delete(name));
  syncRequestCookieHeader(request, requestHeaders);

  const response = createResponse();
  cookieNamesToClear.forEach((name) => response.cookies.set(name, '', EXPIRED_COOKIE_OPTIONS));
  return response;
}
