export type ShowPollingState =
  | { kind: 'waiting' | 'refreshing' | 'paused' | 'unavailable' }
  | { kind: 'retrying' | 'rate-limited'; retryAfterSeconds: number };

type Timer = ReturnType<typeof setTimeout>;

function retryDelay(value: string | null, now: number): number {
  if (!value?.trim()) return 30_000;
  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(milliseconds) && milliseconds > 0 ? Math.max(1000, milliseconds) : 30_000;
}

function readStatus(value: unknown): 'running' | 'completed' | 'failed' {
  if (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === true &&
    'status' in value &&
    (value.status === 'running' || value.status === 'completed' || value.status === 'failed')
  ) {
    return value.status;
  }
  throw new Error('Invalid show status response.');
}

/** Only check the existing show; retries must never create or charge for another one. */
export function startShowStatusPolling({
  url,
  onState,
  onSettled,
  request = fetch,
  schedule = setTimeout,
  cancel = clearTimeout,
  now = Date.now,
}: {
  url: string;
  onState: (state: ShowPollingState) => void;
  onSettled: () => void;
  request?: typeof fetch;
  schedule?: (callback: () => void, milliseconds: number) => Timer;
  cancel?: (timer: Timer) => void;
  now?: () => number;
}): () => void {
  let stopped = false;
  let failures = 0;
  let nextCheck: Timer | null = null;
  let requestTimeout: Timer | null = null;
  let controller: AbortController | null = null;

  function stop() {
    stopped = true;
    if (nextCheck !== null) cancel(nextCheck);
    if (requestTimeout !== null) cancel(requestTimeout);
    controller?.abort();
  }

  function checkLater(milliseconds: number) {
    if (stopped) return;
    nextCheck = schedule(() => {
      nextCheck = null;
      void poll();
    }, milliseconds);
  }

  async function poll() {
    if (stopped) return;
    const abort = new AbortController();
    controller = abort;
    const timeout = schedule(() => abort.abort(), 15_000);
    requestTimeout = timeout;
    try {
      const response = await request(url, {
        method: 'GET',
        cache: 'no-store',
        signal: abort.signal,
      });
      if (stopped) return;
      if (response.status === 404 || response.status === 410) {
        stop();
        onState({ kind: 'unavailable' });
        return;
      }
      if (response.status === 429) {
        const delay = retryDelay(response.headers.get('Retry-After'), now());
        onState({ kind: 'rate-limited', retryAfterSeconds: Math.ceil(delay / 1000) });
        checkLater(delay);
        return;
      }
      if (!response.ok) throw new Error('Show status is temporarily unavailable.');
      const value: unknown = await response.json();
      if (stopped) return;
      const status = readStatus(value);
      failures = 0;
      if (status !== 'running') {
        stop();
        onState({ kind: 'refreshing' });
        onSettled();
        return;
      }
      onState({ kind: 'waiting' });
      checkLater(5000);
    } catch {
      if (stopped) return;
      failures += 1;
      if (failures >= 3) {
        stop();
        onState({ kind: 'paused' });
      } else {
        const delay = 5000 * 2 ** (failures - 1);
        onState({ kind: 'retrying', retryAfterSeconds: delay / 1000 });
        checkLater(delay);
      }
    } finally {
      cancel(timeout);
      requestTimeout = null;
      controller = null;
    }
  }

  onState({ kind: 'waiting' });
  void poll();
  return stop;
}
