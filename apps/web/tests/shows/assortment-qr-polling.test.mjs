import assert from 'node:assert/strict';
import { test } from 'node:test';

await import('../../../../scripts/renderer/register-typescript.mjs');
const { startShowStatusPolling } =
  await import('../../app/(kiosk)/a/[token]/show/[showToken]/_components/show-status-polling.ts');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const status = (value) => Response.json({ ok: true, status: value });

function harness(request) {
  let time = Date.UTC(2026, 0, 1);
  let nextId = 0;
  let settled = 0;
  const timers = new Map();
  const states = [];
  const requests = [];
  const stop = startShowStatusPolling({
    url: '/api/assortments/pack/shows/show',
    request: (url, options) => {
      requests.push({ url, ...options });
      return request(url, options);
    },
    schedule: (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { callback, at: time + delay });
      return id;
    },
    cancel: (id) => timers.delete(id),
    now: () => time,
    onState: (state) => states.push(state),
    onSettled: () => settled++,
  });
  return {
    stop,
    states,
    requests,
    timers,
    get settled() {
      return settled;
    },
    get delay() {
      return Math.min(...[...timers.values()].map((timer) => timer.at)) - time;
    },
    async next() {
      const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      timers.delete(id);
      time = timer.at;
      timer.callback();
      await flush();
    },
  };
}

test('QR status checks are serial GETs and settle once without creating a show', async () => {
  let resolve;
  let calls = 0;
  const pending = new Promise((done) => (resolve = done));
  const h = harness(() => (++calls === 1 ? pending : Promise.resolve(status('completed'))));
  assert.equal(h.requests.length, 1);
  assert.equal(h.timers.size, 1, 'only the request deadline is scheduled while pending');
  resolve(status('running'));
  await flush();
  assert.equal(h.delay, 5000);
  await h.next();
  assert.equal(h.settled, 1);
  assert.equal(h.timers.size, 0);
  assert.deepEqual(h.states.at(-1), { kind: 'refreshing' });
  assert.ok(
    h.requests.every((request) => request.method === 'GET' && request.cache === 'no-store'),
  );
  assert.ok(h.requests.every((request) => request.url.endsWith('/shows/show')));
});

for (const [name, request] of [
  ['network failure', () => Promise.reject(new TypeError('offline'))],
  ['503 response', () => Promise.resolve(new Response(null, { status: 503 }))],
  ['invalid JSON', () => Promise.resolve(new Response('<html>gateway</html>'))],
  ['unknown status', () => Promise.resolve(status('unknown'))],
  ['missing status', () => Promise.resolve(Response.json({ ok: true }))],
]) {
  test(`${name} backs off and pauses after three failures`, async () => {
    const h = harness(request);
    await flush();
    assert.equal(h.delay, 5000);
    assert.equal(h.states.at(-1).kind, 'retrying');
    await h.next();
    assert.equal(h.delay, 10_000);
    await h.next();
    assert.deepEqual(h.states.at(-1), { kind: 'paused' });
    assert.equal(h.requests.length, 3);
    assert.equal(h.settled, 0);
    assert.equal(h.timers.size, 0);
  });
}

test('a successful check resets the consecutive failure budget', async () => {
  const replies = [503, 200, 503, 503, 200];
  const h = harness(() => {
    const code = replies.shift();
    return Promise.resolve(code === 200 ? status('running') : new Response(null, { status: code }));
  });
  await flush();
  await h.next();
  assert.equal(h.states.at(-1).kind, 'waiting');
  await h.next();
  assert.equal(h.delay, 5000);
  await h.next();
  assert.equal(h.delay, 10_000);
  await h.next();
  assert.equal(h.states.at(-1).kind, 'waiting');
  h.stop();
});

for (const [header, delay] of [
  ['120', 120_000],
  ['Thu, 01 Jan 2026 00:02:00 GMT', 120_000],
  ['invalid', 30_000],
  [null, 30_000],
]) {
  test(`429 honours Retry-After ${header} and resumes without a refresh`, async () => {
    let limited = true;
    const h = harness(() => {
      if (!limited) return Promise.resolve(status('running'));
      limited = false;
      return Promise.resolve(
        new Response(null, { status: 429, headers: header ? { 'Retry-After': header } : {} }),
      );
    });
    await flush();
    assert.deepEqual(h.states.at(-1), { kind: 'rate-limited', retryAfterSeconds: delay / 1000 });
    assert.equal(h.delay, delay);
    assert.equal(h.settled, 0);
    await h.next();
    assert.equal(h.states.at(-1).kind, 'waiting');
    assert.equal(h.delay, 5000);
    h.stop();
  });
}

for (const code of [404, 410]) {
  test(`${code} stops checking an unavailable link`, async () => {
    const h = harness(() => Promise.resolve(new Response(null, { status: code })));
    await flush();
    assert.deepEqual(h.states.at(-1), { kind: 'unavailable' });
    assert.equal(h.timers.size, 0);
    assert.equal(h.settled, 0);
  });
}

test('a failed generation refreshes once so the existing retry UI can render', async () => {
  const h = harness(() => Promise.resolve(status('failed')));
  await flush();
  assert.equal(h.settled, 1);
  assert.equal(h.timers.size, 0);
});

test('a stalled request times out and then retries without overlapping requests', async () => {
  const h = harness((url, { signal }) => {
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  });
  assert.equal(h.delay, 15_000);
  await h.next();
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.states.at(-1).kind, 'retrying');
  assert.equal(h.requests.length, 1);
  assert.equal(h.delay, 5000);
  h.stop();
});

test('unmount aborts the request and ignores a late response', async () => {
  let resolve;
  const h = harness(() => new Promise((done) => (resolve = done)));
  h.stop();
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.timers.size, 0);
  resolve(status('completed'));
  await flush();
  assert.equal(h.settled, 0);
  assert.deepEqual(h.states, [{ kind: 'waiting' }]);
  assert.equal(h.timers.size, 0);
});

test('cleanup cancels the next check and a fresh checker can retry the existing show', async () => {
  const first = harness(() => Promise.resolve(new Response(null, { status: 503 })));
  await flush();
  first.stop();
  assert.equal(first.timers.size, 0);
  const second = harness(() => Promise.resolve(status('completed')));
  await flush();
  assert.equal(second.settled, 1);
  assert.equal(second.requests[0].url, first.requests[0].url);
  assert.equal(second.requests[0].method, 'GET');
});
