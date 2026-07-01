/**
 * Shared fetch wrapper for server-side Supabase clients.
 *
 * Adds a hard timeout so a stalled DNS lookup or TCP connect surfaces as a
 * fast fetch error instead of hanging until the OS timeout. This is the fix
 * for the `/shows?page=3` ETIMEDOUT/ENOTFOUND cascade that hung for ~18s: with
 * no timeout, a transient resolver or connect failure blocked the whole page
 * until the network stack gave up, then `listShowsForCurrentUser` swallowed it
 * as an empty list.
 *
 * Node's global `fetch` (undici) already pools connections per origin, so
 * repeated calls to the same Supabase host reuse their TCP/TLS connection;
 * the timeout just caps the worst case per call.
 *
 * Pass the returned function to `createServerClient` / `createClient` via
 * `global: { fetch }`.
 */

export function createSupabaseFetch(timeoutMs = 8_000) {
  return async function supabaseFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const signal = init?.signal ?? AbortSignal.timeout(timeoutMs);
    return fetch(input, { ...init, signal });
  };
}

/** Read and auth path: fail fast at 8s rather than hanging ~18s. */
export const supabaseFetch = createSupabaseFetch(8_000);

/** Service-role uploads (PNG cover backfill, firework imports): allow 30s. */
export const supabaseFetchLong = createSupabaseFetch(30_000);
