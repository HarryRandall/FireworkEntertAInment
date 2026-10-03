/** Synthetic provider responses exercise caching, input validation and private-key boundaries. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jamendoProvider } from '../lib/shopper/music/provider.ts';
import { musicTrackSchema, musicRequestSchema } from '../lib/shopper/music/contracts.ts';
const raw = {
  id: '123',
  name: 'Synthetic sky',
  artist_name: 'Test artist',
  duration: 120,
  audio: 'https://prod-1.storage.jamendo.com/audio?trackid=123',
  license_ccurl: 'https://creativecommons.org/licenses/by/4.0/',
};
const response = (results = [raw]) =>
  Response.json({ headers: { code: 0, status: 'success' }, results });
test('search normalises cache keys, shares in-flight reads and expires the bounded cache', async () => {
  let calls = 0;
  let time = 0;
  const provider = jamendoProvider(
    'synthetic-private-key',
    async (url) => {
      calls += 1;
      assert.equal(new URL(url).searchParams.get('client_id'), 'synthetic-private-key');
      assert.equal(new URL(url).searchParams.get('search'), 'sky');
      return response();
    },
    () => time,
  );
  const [first, second] = await Promise.all([provider.search(' SKY '), provider.search('sky')]);
  assert.deepEqual(first, second);
  assert.equal(calls, 1);
  assert.equal(first[0].duration_ms, 120000);
  assert.equal(first[0].licence_code, 'CC-BY-4.0');
  assert.match(first[0].attribution, /Synthetic sky by Test artist/);
  assert.equal(JSON.stringify(first).includes('synthetic-private-key'), false);
  time = 300001;
  await provider.search('sky');
  assert.equal(calls, 2);
});
test('identity lookup ignores mismatched results and never trusts card metadata', async () => {
  const provider = jamendoProvider('synthetic', async () => response());
  assert.equal((await provider.track('123')).title, 'Synthetic sky');
  assert.equal(await provider.track('456'), null);
  await assert.rejects(provider.track('123&client_id=bad'));
  assert.equal(
    musicRequestSchema.safeParse({
      session: crypto.randomUUID(),
      candidate: crypto.randomUUID(),
      revision: 0,
      track: '123',
      audio_url: raw.audio,
    }).success,
    false,
  );
});
test('upstream failures stay failures, remove cache entries and hide credential-bearing URLs', async () => {
  let calls = 0;
  const provider = jamendoProvider('private-key', async () => {
    calls += 1;
    if (calls === 1) throw new Error('https://api.jamendo.com/?client_id=private-key');
    return response([]);
  });
  await assert.rejects(provider.search('sky'), (error) => !error.message.includes('private-key'));
  assert.deepEqual(await provider.search('sky'), []);
  assert.equal(calls, 2);
  const rejected = jamendoProvider('synthetic', async () =>
    Response.json({ headers: { code: 1, status: 'failed' }, results: [] }),
  );
  await assert.rejects(rejected.search('sky'), /rejected request/);
});
test('malformed timelines, arbitrary audio origins and unsafe licence links are rejected', async () => {
  for (const changed of [
    { audio: 'https://localhost/audio' },
    { audio: 'http://prod-1.storage.jamendo.com/audio' },
    { license_ccurl: 'https://example.com/licenses/by/4.0/' },
    { duration: -1 },
    { duration: 3601 },
  ]) {
    const provider = jamendoProvider('synthetic', async () => response([{ ...raw, ...changed }]));
    await assert.rejects(provider.search('sky'));
  }
  const valid = (await jamendoProvider('synthetic', async () => response()).search('sky'))[0];
  for (const audio_url of [
    'https://user:password@prod-1.storage.jamendo.com/audio',
    'https://prod-1.storage.jamendo.com:444/audio',
  ])
    assert.equal(musicTrackSchema.safeParse({ ...valid, audio_url }).success, false);
});
test('cache bounds evict the oldest search and overlong queries never call the provider', async () => {
  let calls = 0;
  const provider = jamendoProvider('synthetic', async () => {
    calls += 1;
    return response([]);
  });
  for (let index = 0; index < 101; index++) await provider.search(`track ${index}`);
  await provider.search('track 0');
  assert.equal(calls, 102);
  await assert.rejects(provider.search('x'.repeat(101)));
  assert.equal(calls, 102);
});
