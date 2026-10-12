import assert from 'node:assert/strict';
import { test } from 'node:test';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { supabaseFetch, supabaseFetchLong } = await import('../../lib/supabase/fetch.ts');

const url = 'https://database.example/rest/v1/shows';

test('safe reads recover from a transient timeout with one bounded retry', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_input, init) => {
    assert.ok(init.signal instanceof AbortSignal);
    calls += 1;
    if (calls === 1) throw new DOMException('Timed out', 'TimeoutError');
    return new Response('[]');
  });
  assert.equal(await (await supabaseFetch(url)).text(), '[]');
  assert.equal(calls, 2);
});

test('writes are never replayed, including methods supplied by Request', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    throw new TypeError('fetch failed');
  });
  await assert.rejects(supabaseFetchLong(new Request(url, { method: 'POST', body: '{}' })));
  await assert.rejects(supabaseFetch(url, { method: 'PATCH', body: '{}' }));
  assert.equal(calls, 2);
});

test('persistent network errors remain failures after the single retry', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    throw new TypeError('fetch failed');
  });
  await assert.rejects(supabaseFetch(url), /fetch failed/);
  assert.equal(calls, 2);
});

test('gateway failures retry reads but authorisation failures stay unchanged', async (t) => {
  let calls = 0;
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: ++calls === 1 ? 503 : 200 }),
  );
  assert.equal((await supabaseFetch(url, { method: 'HEAD' })).status, 200);
  assert.equal(calls, 2);
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(null, { status: 403 });
  });
  assert.equal((await supabaseFetch(url)).status, 403);
  assert.equal(calls, 3);
});

test('caller cancellation is preserved and never retried', async (t) => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_input, init) => {
    calls += 1;
    init.signal.throwIfAborted();
  });
  await assert.rejects(supabaseFetch(url, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('gateway failures never replay mutation requests', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(null, { status: 503 });
  });
  assert.equal((await supabaseFetchLong(url, { method: 'POST', body: '{}' })).status, 503);
  assert.equal(calls, 1);
});
