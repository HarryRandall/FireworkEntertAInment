/** Activity batching, bounded transport and immediate opt-out behaviour. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEventBatcher } from '../lib/shopper/events/batch.ts';
import { batchSchema } from '../lib/shopper/events/contracts.ts';
const event = {
  type: 'store_view',
  store: '30000000-0000-4000-8000-000000000001',
  context: {},
  props: {},
};
function harness(send = async () => {}) {
  const timers = new Map();
  const errors = [];
  let index = 0;
  const queue = createEventBatcher(
    send,
    (error) => errors.push(error),
    (callback, delay) => {
      assert.equal(delay, 1000);
      timers.set(++index, callback);
      return index;
    },
    (timer) => timers.delete(timer),
  );
  return { queue, timers, errors };
}
test('taps coalesce without waiting for network completion', async () => {
  const sent = [];
  let finish;
  const held = new Promise((resolve) => {
    finish = resolve;
  });
  const { queue, timers } = harness(async (events) => {
    sent.push(events);
    await held;
  });
  queue.add(event);
  queue.add({ ...event, type: 'product_view' });
  assert.equal(sent.length, 0);
  assert.equal(timers.size, 1);
  queue.flush();
  assert.equal(sent[0].length, 2);
  queue.add(event);
  queue.flush();
  assert.equal(sent.length, 2);
  finish();
  await held;
});
test('opt-out removes queued activity for only the chosen store', () => {
  const sent = [];
  const { queue } = harness(async (events) => {
    sent.push(events);
  });
  queue.add(event);
  const other = { ...event, store: '30000000-0000-4000-8000-000000000002' };
  queue.add(other);
  queue.drop(event.store);
  queue.flush();
  assert.deepEqual(sent, [[other]]);
});
test('queue memory and each batch are bounded', () => {
  const sent = [];
  const { queue, errors } = harness(async (events) => {
    sent.push(events);
  });
  for (let index = 0; index < 101; index++) queue.add(event);
  assert.equal(errors.length, 1);
  for (let index = 0; index < 6; index++) queue.flush();
  assert.deepEqual(
    sent.map((batch) => batch.length),
    [20, 20, 20, 20, 20],
  );
});
test('failed sends are reported without an ambiguous replay', async () => {
  let calls = 0;
  const { queue, errors } = harness(async () => {
    calls++;
    throw new Error('offline');
  });
  queue.add(event);
  queue.flush();
  await Promise.resolve();
  queue.flush();
  assert.equal(calls, 1);
  assert.equal(errors.length, 1);
});
test('batch boundary refuses personal props, unknown events and oversized batches', () => {
  const batch = { session_key: 'visit', events: [event] };
  assert.equal(batchSchema.safeParse(batch).success, true);
  for (const events of [
    Array(21).fill(event),
    [{ ...event, type: 'unknown' }],
    [{ ...event, props: { email: 'private@example.invalid' } }],
    [{ ...event, context: { shopper_id: event.store } }],
  ])
    assert.equal(batchSchema.safeParse({ ...batch, events }).success, false);
});

test('saved client opt-out drops queued and future activity until sharing resumes', async () => {
  const { registerEventStore, recordShopperEvent, setActivityConsent } =
    await import('../lib/shopper/events/client.ts');
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const window = new EventTarget();
  const document = new EventTarget();
  const sent = [];
  globalThis.window = window;
  globalThis.document = document;
  globalThis.fetch = async (_url, request) => {
    sent.push(JSON.parse(request.body));
    return new Response('{}');
  };
  try {
    const organisation = '30000000-0000-4000-8000-000000000010';
    const otherLocation = { ...event, store: '30000000-0000-4000-8000-000000000011' };
    registerEventStore(event.store, organisation);
    registerEventStore(otherLocation.store, organisation);
    recordShopperEvent(event);
    recordShopperEvent(otherLocation);
    setActivityConsent(organisation, false);
    recordShopperEvent(event);
    recordShopperEvent(otherLocation);
    window.dispatchEvent(new Event('pagehide'));
    assert.equal(sent.length, 0);
    setActivityConsent(organisation, true);
    recordShopperEvent(event);
    window.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();
    assert.deepEqual(sent[0].events, [event]);
    assert.match(sent[0].session_key, /^[a-f0-9-]{36}$/);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  }
});
