import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readResponseTextWithLimit, ResponseBodyTooLargeError } from '../lib/bounded-response.ts';

test('bounded response reader accepts a body within its UTF-8 byte limit', async () => {
  const response = new Response('fireworks');

  assert.equal(await readResponseTextWithLimit(response, 9), 'fireworks');
});

test('bounded response reader rejects an excessive declared content length', async () => {
  const response = new Response('small', { headers: { 'content-length': '100' } });

  await assert.rejects(
    readResponseTextWithLimit(response, 10),
    (error) => error instanceof ResponseBodyTooLargeError && error.maximumBytes === 10,
  );
});

test('bounded response reader counts streamed UTF-8 bytes without a content length', async () => {
  const response = new Response('\u{1F386}');

  await assert.rejects(
    readResponseTextWithLimit(response, 3),
    (error) => error instanceof ResponseBodyTooLargeError && error.maximumBytes === 3,
  );
});
