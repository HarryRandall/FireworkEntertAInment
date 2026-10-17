/**
 * The public replay-cues endpoint turns catalogue and network read failures
 * into an explicit unavailable response instead of a silent empty show.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeEach, test } from 'node:test';

await import('../../../../scripts/renderer/register-typescript.mjs');
const root = process.cwd();

const STUBS = {
  'server-only': 'export {};',
  '@/lib/shows/queries.server': `
    export async function listReplayPreviewCuesForShow(showId, windowSeconds) {
      globalThis.replayRoute.calls.push([showId, windowSeconds]);
      const outcome = globalThis.replayRoute.outcome;
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }
  `,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') specifier = 'next/server.js';
    if (specifier in STUBS) {
      return {
        url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`,
        shortCircuit: true,
      };
    }
    let unresolvedPath = null;
    if (specifier.startsWith('@/')) {
      unresolvedPath = join(root, specifier.slice(2));
    } else if (
      specifier.startsWith('.') &&
      context.parentURL?.startsWith('file:') &&
      !context.parentURL.includes('/node_modules/')
    ) {
      unresolvedPath = join(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (unresolvedPath) {
      for (const candidate of [
        unresolvedPath,
        `${unresolvedPath}.ts`,
        join(unresolvedPath, 'index.ts'),
      ]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const [{ GET }, { CatalogueReadError, ShowsNetworkError }] = await Promise.all([
  import('../../app/api/shows/[id]/replay-cues/route.ts'),
  import('../../lib/shows/read-errors.ts'),
]);

const request = (query = '') =>
  new Request(`https://showcrafter.test/api/shows/show/replay-cues${query}`);
const params = Promise.resolve({ id: 'show' });

beforeEach(() => {
  globalThis.replayRoute = { calls: [], outcome: [] };
});

test('a catalogue read failure is an explicit 503 with no cues, not an empty success', async () => {
  globalThis.replayRoute.outcome = new CatalogueReadError(
    { code: '57014', message: 'canceling statement due to statement timeout' },
    { table: 'multishot_fireworks' },
  );
  const response = await GET(request('?window=12'), { params });
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), { cues: [] });
  assert.ok(!body.includes('57014'), 'database detail stays out of the public response');
  assert.deepEqual(globalThis.replayRoute.calls, [['show', 12]]);
});

test('a network failure keeps the same explicit unavailable contract', async () => {
  globalThis.replayRoute.outcome = new ShowsNetworkError(new Error('fetch failed'));
  const response = await GET(request(), { params });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { cues: [] });
});

test('healthy reads return cues and unexpected errors still surface', async () => {
  globalThis.replayRoute.outcome = [{ id: 'cue-1', timeSeconds: 0.5 }];
  const response = await GET(request(), { params });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { cues: [{ id: 'cue-1', timeSeconds: 0.5 }] });

  globalThis.replayRoute.outcome = new TypeError('unexpected');
  await assert.rejects(GET(request(), { params }), TypeError);
});
