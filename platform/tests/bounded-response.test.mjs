import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readResponseTextWithLimit, ResponseBodyTooLargeError } from '../lib/bounded-response.ts';

test('bounded response reader accepts a body within its UTF-8 byte limit', async () => {
  assert.equal(await readResponseTextWithLimit(new Response('fireworks'), 9), 'fireworks');
});

test('bounded response reader rejects excessive declared and streamed byte counts', async () => {
  const declared = new Response('small', { headers: { 'content-length': '100' } });
  await assert.rejects(
    readResponseTextWithLimit(declared, 10),
    (error) => error instanceof ResponseBodyTooLargeError && error.maximumBytes === 10,
  );

  await assert.rejects(
    readResponseTextWithLimit(new Response('\u{1F386}'), 3),
    (error) => error instanceof ResponseBodyTooLargeError && error.maximumBytes === 3,
  );
});
