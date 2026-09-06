import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const modules = new Map([
  [
    'lib/assortments/public.server.ts',
    'export const getAssortmentServiceClient = () => {throw Error("Client must be injected")};',
  ],
  [
    'lib/jamendo.server.ts',
    'export const browseJamendoTracks = async (...args) => globalThis.recommendFixture.browse(...args);',
  ],
  [
    'lib/shows/queries.server.ts',
    'export const listFireworkProducts = async (options) => globalThis.recommendFixture.products(options);',
  ],
  [
    'lib/cue-generation/product-timing.server.ts',
    'export const loadProductTimingProfiles = async () => new Map();',
  ],
]);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return nextResolve('data:text/javascript,export {};', context);
    const path = specifier.startsWith('@/')
      ? join(process.cwd(), specifier.slice(2))
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        ? join(dirname(fileURLToPath(context.parentURL)), specifier)
        : null;
    if (path)
      for (const candidate of [path, `${path}.ts`]) {
        const replacement = modules.get(candidate.slice(process.cwd().length + 1));
        if (replacement)
          return nextResolve(`data:text/javascript,${encodeURIComponent(replacement)}`, context);
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    return nextResolve(specifier, context);
  },
});
const { recommendAssortmentMusic } =
  await import('../../lib/assortments/music-recommendations.server.ts');
const makeAnalysis = () =>
  JSON.parse(
    readFileSync(new URL('../fixtures/recommendation-analysis.json', import.meta.url), 'utf8'),
  );
const track = {
  provider: 'jamendo',
  trackId: '123',
  title: 'Public song',
  artist: 'Artist',
  durationSeconds: 60,
  previewUrl: 'https://example.com/audio.mp3',
  sourceUrl: 'https://www.jamendo.com/track/123',
  licenceName: 'CC BY',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  imageUrl: null,
  peaks: null,
};
function fixture({ error = null, rows = [], missing = false } = {}) {
  const calls = [];
  globalThis.recommendFixture = {
    browse: async (...args) => {
      calls.push(['browse', ...args]);
      return { tracks: [track] };
    },
    products: async (options) => {
      calls.push(['products', options.scopedRead.ids]);
      return missing ? [] : [{ id: 'product' }];
    },
  };
  const query = { then: (resolve) => Promise.resolve({ data: rows, error }).then(resolve) };
  for (const method of ['select', 'eq', 'not', 'in', 'order', 'limit'])
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  const supabase = {
    from: (table) => {
      calls.push(['from', table]);
      return query;
    },
  };
  return { calls, supabase };
}
const assortment = {
  fundingUserId: 'private-owner',
  items: [{ catalogueItemId: 'product', quantity: 1 }],
};

test('recommendations reuse validated owner analyses, only return provider songs and never write', async () => {
  const { supabase, calls } = fixture({
    rows: [{ source_track_id: '123', analysis_json: makeAnalysis() }],
  });
  const result = await recommendAssortmentMusic(assortment, { supabase });
  assert.deepEqual(result.tracks, [track]);
  assert.ok(
    calls.some((call) => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'private-owner'),
  );
  assert.ok(
    calls.some((call) => call[0] === 'eq' && call[1] === 'status' && call[2] === 'completed'),
  );
  assert.deepEqual(
    calls.find((call) => call[0] === 'in'),
    ['in', 'source_track_id', ['123']],
  );
  assert.equal(calls.filter((call) => call[0] === 'browse').length, 3);
  assert.doesNotMatch(JSON.stringify(result), /private-owner|analysis_json|score/);
  assert.doesNotMatch(result.reasons['123'].join(' '), /not been analysed/);
});

test('analysis query and missing catalogue failures do not become successful fallback recommendations', async () => {
  await assert.rejects(
    recommendAssortmentMusic(assortment, {
      supabase: fixture({ error: { message: 'database failure' } }).supabase,
    }),
  );
  await assert.rejects(
    recommendAssortmentMusic(assortment, { supabase: fixture({ missing: true }).supabase }),
  );
});

test('invalid historical analysis is excluded and explicitly uses duration-only evidence', async () => {
  const { supabase } = fixture({
    rows: [{ source_track_id: '123', analysis_json: { invalid: true } }],
  });
  const result = await recommendAssortmentMusic(assortment, { supabase });
  assert.match(result.reasons['123'].join(' '), /not been analysed/);
});

test('completed 1.5.0 analysis remains reusable recommendation evidence', async () => {
  const analysis = { ...makeAnalysis(), schema_version: '1.5.0', bar_grid_confidence: 0.195 };
  const { supabase } = fixture({ rows: [{ source_track_id: '123', analysis_json: analysis }] });
  const result = await recommendAssortmentMusic(assortment, { supabase });
  assert.deepEqual(result.tracks, [track]);
  assert.doesNotMatch(result.reasons['123'].join(' '), /not been analysed/);
});
