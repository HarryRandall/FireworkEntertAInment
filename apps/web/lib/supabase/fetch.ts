/** Bounded server-side requests. Only safe reads may be retried. */
import { isSupabaseTransientNetworkError } from './errors';

function createSupabaseFetch(timeoutMs = 8_000) {
  return async function supabaseFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const request = input instanceof Request ? input : null;
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const canRetry = method === 'GET' || method === 'HEAD';
    const callerSignal = init?.signal ?? request?.signal;
    for (let attempt = 0; ; attempt += 1) {
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
      try {
        const response = await fetch(input, { ...init, signal });
        if (
          canRetry &&
          attempt === 0 &&
          !callerSignal?.aborted &&
          [502, 503, 504].includes(response.status)
        ) {
          await response.body?.cancel();
          continue;
        }
        return response;
      } catch (error) {
        // Writes may have committed before a connection failed. Never replay them.
        if (
          !canRetry ||
          attempt > 0 ||
          callerSignal?.aborted ||
          !isSupabaseTransientNetworkError(error)
        )
          throw error;
      }
    }
  };
}

/** Fail each read attempt within 8s, with one retry for transient network failures. */
export const supabaseFetch = createSupabaseFetch(8_000);

/** Nested catalogue joins can exceed the default timeout on cold starts. */
export const supabaseFetchCatalogue = createSupabaseFetch(20_000);

/** Service-role uploads allow 30s; writes still run exactly once. */
export const supabaseFetchLong = createSupabaseFetch(30_000);
