import 'server-only';

const MAX_DISPATCH_ATTEMPTS = 3;
const MAX_ACKNOWLEDGEMENT_BYTES = 4_096;
const MAX_CALL_ID_LENGTH = 240;
const MIN_SHARED_SECRET_LENGTH = 32;
const MAX_SHARED_SECRET_LENGTH = 512;
const TRANSIENT_RESPONSE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

type DispatchEnvironment = {
  NODE_ENV?: string;
  FIREWORK_IMPORT_URL?: string;
  FIREWORK_IMPORT_SHARED_SECRET?: string;
  FIREWORK_IMPORT_ALLOWED_HOSTS?: string;
};

export type FireworkImportDispatchConfiguration =
  | { mode: 'direct'; dispatchUrl: URL; secret: string }
  | { mode: 'local-worker' }
  | { mode: 'invalid'; error: string };

export type FireworkImportDispatchResult =
  | { dispatched: true; callId: string; attempts: number }
  | {
      dispatched: false;
      reason: 'local-worker' | 'configuration' | 'request-failed';
      attempts: number;
      error: string;
    };

type DispatchOptions = {
  environment?: DispatchEnvironment;
  fetchImpl?: typeof fetch;
  wait?: (delayMs: number) => Promise<void>;
};

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function isLocalHost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase());
}

function parseAllowedHosts(rawValue: string | undefined): Set<string> | null {
  const hosts = new Set<string>();
  for (const rawHost of (rawValue ?? '').split(',')) {
    const host = rawHost.trim().toLowerCase();
    if (!host) continue;
    if (
      host.includes('/') ||
      host.includes(':') ||
      host.includes('@') ||
      host.includes('?') ||
      host.includes('#')
    ) {
      return null;
    }
    hosts.add(host);
  }
  return hosts;
}

/**
 * Resolve the dispatch mode without making a network request. Production has
 * no polling fallback, while development deliberately keeps the lease-aware
 * local worker available when direct Modal dispatch is not configured.
 */
export function getFireworkImportDispatchConfiguration(
  environment: DispatchEnvironment = process.env,
): FireworkImportDispatchConfiguration {
  const production = environment.NODE_ENV === 'production';
  const endpoint = environment.FIREWORK_IMPORT_URL?.trim();
  if (!endpoint) {
    return production
      ? { mode: 'invalid', error: 'FIREWORK_IMPORT_URL is not configured.' }
      : { mode: 'local-worker' };
  }

  let dispatchUrl: URL;
  try {
    dispatchUrl = new URL(endpoint);
  } catch {
    return { mode: 'invalid', error: 'FIREWORK_IMPORT_URL is not a valid URL.' };
  }

  const localHost = isLocalHost(dispatchUrl.hostname);
  const developmentHttp = !production && localHost;
  const allowedHosts = parseAllowedHosts(environment.FIREWORK_IMPORT_ALLOWED_HOSTS);
  const trustedModalHost =
    dispatchUrl.hostname === 'modal.run' || dispatchUrl.hostname.endsWith('.modal.run');
  if (
    !allowedHosts ||
    dispatchUrl.username ||
    dispatchUrl.password ||
    dispatchUrl.search ||
    dispatchUrl.hash ||
    (production && localHost) ||
    (dispatchUrl.protocol !== 'https:' && !(dispatchUrl.protocol === 'http:' && developmentHttp)) ||
    (!localHost && !trustedModalHost && !allowedHosts.has(dispatchUrl.hostname.toLowerCase()))
  ) {
    return { mode: 'invalid', error: 'FIREWORK_IMPORT_URL is not an allowed dispatch endpoint.' };
  }

  const pathname = dispatchUrl.pathname.replace(/\/+$/, '');
  dispatchUrl.pathname = pathname.endsWith('/runs') ? pathname : `${pathname}/runs`;

  const secret = environment.FIREWORK_IMPORT_SHARED_SECRET?.trim() ?? '';
  if (secret.length < MIN_SHARED_SECRET_LENGTH || secret.length > MAX_SHARED_SECRET_LENGTH) {
    return {
      mode: 'invalid',
      error: `FIREWORK_IMPORT_SHARED_SECRET must contain ${MIN_SHARED_SECRET_LENGTH}-${MAX_SHARED_SECRET_LENGTH} characters.`,
    };
  }

  return { mode: 'direct', dispatchUrl, secret };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseAcknowledgement(
  response: Response,
  body: string,
  runId: string,
): { success: true; callId: string } | { success: false; error: string } {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (response.status !== 202 || !/^application\/json(?:\s*;|$)/.test(contentType)) {
    return {
      success: false,
      error: `Modal dispatch returned HTTP ${response.status} without the required JSON acknowledgement.`,
    };
  }
  if (!body || body.length > MAX_ACKNOWLEDGEMENT_BYTES) {
    return { success: false, error: 'Modal dispatch returned an invalid acknowledgement body.' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return { success: false, error: 'Modal dispatch returned malformed JSON.' };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { success: false, error: 'Modal dispatch returned an invalid acknowledgement.' };
  }
  const acknowledgement = payload as Record<string, unknown>;
  const callId = typeof acknowledgement.callId === 'string' ? acknowledgement.callId.trim() : '';
  if (
    acknowledgement.runId !== runId ||
    acknowledgement.status !== 'accepted' ||
    callId.length < 1 ||
    callId.length > MAX_CALL_ID_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(callId)
  ) {
    return {
      success: false,
      error: 'Modal dispatch acknowledgement did not match the requested run.',
    };
  }
  return { success: true, callId };
}

function safeRequestError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'Modal dispatch request timed out.';
  }
  return 'Modal dispatch request failed before acknowledgement.';
}

/**
 * Dispatch one durable run with bounded retries. Only transient transport and
 * response failures are retried; authentication, contract and acknowledgement
 * failures stop immediately so the caller can atomically refund the queued run.
 */
export async function dispatchFireworkImportRun(
  runId: string,
  options: DispatchOptions = {},
): Promise<FireworkImportDispatchResult> {
  if (!isUuid(runId)) {
    return {
      dispatched: false,
      reason: 'configuration',
      attempts: 0,
      error: 'The reconstruction run ID is invalid.',
    };
  }

  const configuration = getFireworkImportDispatchConfiguration(options.environment ?? process.env);
  if (configuration.mode === 'local-worker') {
    return {
      dispatched: false,
      reason: 'local-worker',
      attempts: 0,
      error: 'Direct dispatch is disabled for the local worker.',
    };
  }
  if (configuration.mode === 'invalid') {
    console.error(`[firework-import] ${configuration.error}`);
    return {
      dispatched: false,
      reason: 'configuration',
      attempts: 0,
      error: configuration.error,
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const waitForRetry = options.wait ?? wait;
  let lastError = 'Modal dispatch request failed.';

  for (let attempt = 1; attempt <= MAX_DISPATCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(configuration.dispatchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${configuration.secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runId }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 202) {
        const body = await response.text();
        const acknowledgement = parseAcknowledgement(response, body, runId);
        if (acknowledgement.success) {
          return { dispatched: true, callId: acknowledgement.callId, attempts: attempt };
        }
        return {
          dispatched: false,
          reason: 'request-failed',
          attempts: attempt,
          error: acknowledgement.error,
        };
      }

      lastError = `Modal dispatch returned HTTP ${response.status}.`;
      if (!TRANSIENT_RESPONSE_STATUSES.has(response.status)) {
        return {
          dispatched: false,
          reason: 'request-failed',
          attempts: attempt,
          error: lastError,
        };
      }
    } catch (error) {
      lastError = safeRequestError(error);
    }

    if (attempt < MAX_DISPATCH_ATTEMPTS) {
      await waitForRetry(250 * 2 ** (attempt - 1));
    }
  }

  console.error(`[firework-import] ${lastError}`);
  return {
    dispatched: false,
    reason: 'request-failed',
    attempts: MAX_DISPATCH_ATTEMPTS,
    error: lastError,
  };
}
