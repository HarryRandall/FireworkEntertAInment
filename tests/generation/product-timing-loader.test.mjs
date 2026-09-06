import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

// Keep the real query, catalogue mapper and timing derivation; isolate unrelated
// request/cache dependencies. The injected Supabase client is the I/O boundary.
const isolated = new Map([
  ['lib/current-user.server.ts', 'export const getCurrentUserId = async () => null;'],
  [
    'lib/server-cache.ts',
    'export const getCachedJson = async () => null; export const setCachedJson = async () => {}; export const deleteCachedKeys = async () => {};',
  ],
  [
    'lib/shows/supabase.ts',
    'export const getCatalogueReadClient = () => { throw Error("Unexpected client"); }; export const getServerClient = getCatalogueReadClient;',
  ],
  [
    'lib/shows/shopping.server.ts',
    'export const computeShoppingListForShow = () => { throw Error("Unexpected shopping read"); };',
  ],
]);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return nextResolve('data:text/javascript,export {};', context);
    if (specifier === 'react')
      return nextResolve('data:text/javascript,export const cache = fn => fn;', context);
    const unresolved = specifier.startsWith('@/')
      ? join(process.cwd(), specifier.slice(2))
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        ? join(dirname(fileURLToPath(context.parentURL)), specifier)
        : null;
    if (unresolved) {
      for (const candidate of [unresolved, `${unresolved}.ts`]) {
        const replacement = isolated.get(candidate.slice(process.cwd().length + 1));
        if (replacement)
          return nextResolve(`data:text/javascript,${encodeURIComponent(replacement)}`, context);
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const [
  { loadProductTimingProfiles },
  { fetchShotsByCatalogueItem },
  { DEFAULT_DESIGN },
  { DEFAULT_FIREWORK_SPEC },
] = await Promise.all([
  import('../../lib/cue-generation/product-timing.server.ts'),
  import('../../lib/shows/queries.server.ts'),
  import('../../lib/fireworks/design.ts'),
  import('../../lib/fireworks/spec.ts'),
]);
const parent = {
  id: 'cake',
  name: 'Cake',
  shotCount: 3,
  caliber: '30mm',
  spec: DEFAULT_FIREWORK_SPEC,
  rawSpec: null,
  renderDesign: DEFAULT_DESIGN,
};
const variant = {
  id: 'child',
  slug: 'child',
  name: 'Child',
  description: null,
  duration_seconds: 3,
  height_meters: 50,
  caliber: '30mm',
  variant_json: {},
  firework_effects: null,
};
function row(offsets = [0, 0.5, 1]) {
  return {
    id: 'cake',
    catalogue_item_kind: 'multishot',
    fireworks: null,
    multishots: {
      multishot_fireworks: offsets.map((offset, index) => ({
        id: `shot-${index}`,
        sequence_index: index,
        time_offset_seconds: offset,
        pan_degrees: index * 10,
        tilt_degrees: 0,
        caliber: '50mm',
        position_override_json: null,
        fireworks: variant,
      })),
    },
  };
}
function client(data, error = null) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'catalogue_items');
      return {
        select(fields) {
          assert.match(fields, /time_offset_seconds/);
          return {
            async in(column, ids) {
              assert.equal(column, 'id');
              calls.push([...ids]);
              return { data, error };
            },
          };
        },
      };
    },
  };
}

test('generation loads real mapped children once and derives all emphasis profiles', async () => {
  const db = client([row()]);
  const profiles = await loadProductTimingProfiles(db, [parent]);
  assert.deepEqual(db.calls, [['cake']]);
  for (const emphasis of ['normal', 'accent', 'peak']) {
    assert.equal(profiles.get('cake')[emphasis].completeness, 'complete');
    assert.equal(profiles.get('cake')[emphasis].resolvedShotCount, 3);
    assert.deepEqual(
      profiles.get('cake')[emphasis].shots.map((shot) => shot.launchOffsetSeconds),
      [0, 0.5, 1],
    );
  }
});

test('missing offsets remain unknown for matching while replay keeps its existing fallback', async () => {
  const db = client([row([0, null, 1])]);
  const profiles = await loadProductTimingProfiles(db, [parent]);
  assert.equal(profiles.get('cake').normal.completeness, 'partial');
  assert.equal(profiles.get('cake').normal.intervals, null);
  const replay = await fetchShotsByCatalogueItem(db, ['cake']);
  assert.equal(replay.get('cake')[1].timeOffsetSeconds, 0);
});

test('missing child rows produce unknown timing and query failures propagate', async () => {
  const missing = await loadProductTimingProfiles(client([]), [parent]);
  assert.equal(missing.get('cake').normal.completeness, 'unknown');
  for (const error of [
    { message: 'permission denied', code: '42501' },
    { message: 'fetch failed' },
  ]) {
    await assert.rejects(
      loadProductTimingProfiles(client(null, error), [parent]),
      /temporarily unavailable/,
    );
  }
});

test('direct-only packs perform no extra query and catalogue batches stay bounded', async () => {
  const directClient = client([]);
  const direct = await loadProductTimingProfiles(directClient, [{ ...parent, shotCount: 1 }]);
  assert.equal(directClient.calls.length, 0);
  assert.equal(direct.get('cake').normal.completeness, 'complete');
  const db = client([]);
  await loadProductTimingProfiles(
    db,
    Array.from({ length: 201 }, (_, index) => ({ ...parent, id: String(index) })),
  );
  assert.deepEqual(
    db.calls.map((ids) => ids.length),
    [100, 100, 1],
  );
});

test('recommendation catalogue reads use the supplied scope and propagate ordinary database errors', async () => {
  const { listFireworkProducts } = await import('../../lib/shows/queries.server.ts');
  const calls = [];
  const query = {
    select() {
      return this;
    },
    order() {
      return this;
    },
    in(column, ids) {
      calls.push([column, ids]);
      return this;
    },
    then(resolve) {
      return Promise.resolve({
        data: null,
        error: { message: 'permission denied', code: '42501' },
      }).then(resolve);
    },
  };
  const db = {
    from(table) {
      assert.equal(table, 'catalogue_items');
      return query;
    },
  };
  await assert.rejects(listFireworkProducts({ scopedRead: { supabase: db, ids: ['cake'] } }));
  assert.deepEqual(calls, [['id', ['cake']]]);
});
