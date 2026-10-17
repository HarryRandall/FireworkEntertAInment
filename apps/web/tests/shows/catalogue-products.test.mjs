/**
 * Behaviour tests for the bounded catalogue read.
 *
 * The real assembly and loader modules run against an in-memory table
 * adapter, so the tests cover the join semantics (ordering, pricing,
 * multishot children, previews), the request shape (flat batched lookups, no
 * nested embed) and the failure contract (read errors throw, never `[]`).
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

await import('../../../../scripts/renderer/register-typescript.mjs');
const root = process.cwd();

const STUBS = {
  'server-only': 'export {};',
  // React's request memo is a pass-through outside a render.
  react: 'export function cache(fn) { return fn; }',
  '@/lib/server-cache': `
    export async function getCachedJson(key) { return globalThis.__catalogueTest.cache.get(key) ?? null; }
    export async function setCachedJson(key, value) { globalThis.__catalogueTest.cache.set(key, value); }
    export async function deleteCachedKeys(keys) { for (const key of keys) globalThis.__catalogueTest.cache.delete(key); }
  `,
  '@/lib/auth/current-user.server': 'export async function getCurrentUserId() { return null; }',
  'lib/shows/supabase': `
    export async function getCatalogueReadClient() { return globalThis.__catalogueTest.supabase; }
    export async function getServerClient() { return globalThis.__catalogueTest.supabase; }
  `,
  'lib/shows/shopping.server':
    'export async function computeShoppingListForShow() { return null; }',
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? '';
    const stubKey =
      specifier in STUBS
        ? specifier
        : specifier.startsWith('.') && parent.includes('/lib/shows/')
          ? Object.keys(STUBS).find(
              (key) =>
                key.startsWith('lib/shows/') && specifier.endsWith(key.slice('lib/shows/'.length)),
            )
          : undefined;
    if (stubKey) {
      return {
        url: `data:text/javascript,${encodeURIComponent(STUBS[stubKey])}`,
        shortCircuit: true,
      };
    }
    let unresolvedPath = null;
    if (specifier.startsWith('@/')) {
      unresolvedPath = join(root, specifier.slice(2));
    } else if (specifier.startsWith('.') && parent.startsWith('file:')) {
      unresolvedPath = join(dirname(fileURLToPath(parent)), specifier);
    }
    if (unresolvedPath) {
      for (const candidate of [unresolvedPath, `${unresolvedPath}.ts`, `${unresolvedPath}.tsx`]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

// Imports stay dynamic so the resolve hook above is registered first. Each one
// destructures its bindings directly so Knip can see which exports tests use.
const { assembleCatalogueItemShots, assembleCatalogueProducts } =
  await import('../../lib/shows/catalogue-products.ts');
const {
  CATALOGUE_FIREWORK_BATCH_SIZE,
  CATALOGUE_ID_BATCH_SIZE,
  CATALOGUE_PAGE_SIZE,
  CATALOGUE_READ_CONCURRENCY,
  CATALOGUE_SHOT_BATCH_SIZE,
  createReadLimiter,
  readCatalogueGraph,
  readCatalogueItems,
} = await import('../../lib/shows/catalogue-products.server.ts');
const { fetchShotsByCatalogueItem, listFireworkProducts } =
  await import('../../lib/shows/queries.server.ts');
const { CatalogueReadError, ShowsNetworkError } = await import('../../lib/shows/read-errors.ts');
const { FIREWORK_PREVIEW_RENDERER_VERSION } = await import('../../lib/firework-preview-image.ts');
const { CATALOGUE_FIREWORK_CARD_SELECT, FIREWORK_VARIANT_SELECT } =
  await import('../../lib/shows/types.ts');
const { effectTemplates } = await import('@showcrafter/renderer');

const PEONY = effectTemplates.find((entry) => entry.key === 'peony').design;

function firework(id, overrides = {}) {
  return {
    id,
    slug: `${id}-slug`,
    name: `Firework ${id}`,
    description: null,
    primary_color: '#ff0000',
    secondary_color: null,
    color_palette: ['#ff0000'],
    caliber: '75mm',
    duration_seconds: 3,
    height_meters: 60,
    design: PEONY,
    design_schema: 1,
    render_snapshot_json: null,
    render_overrides_json: {},
    variant_json: { reconstructionShot: { panDegrees: 12, tiltDegrees: -4 } },
    firework_effects: {
      id: 'effect',
      slug: 'peony',
      name: 'Peony',
      pattern_key: 'sphere',
      template_key: 'peony',
    },
    firework_preview_images: {
      source_revision: 7,
      renderer_version: FIREWORK_PREVIEW_RENDERER_VERSION,
      storage_path: `${FIREWORK_PREVIEW_RENDERER_VERSION}/${id}.webp`,
    },
    ...overrides,
  };
}

function item(id, name, overrides = {}) {
  return {
    id,
    name,
    part_number: `PN-${id}`,
    manufacturer: 'Maker',
    description: `${name} description`,
    duration_seconds: null,
    catalogue_item_kind: 'single',
    firework_id: null,
    multishot_id: null,
    is_listed: true,
    ...overrides,
  };
}

/** Catalogue fixture: priced direct, multishot, orphaned direct, broken multishot, unlisted. */
function fixtureTables() {
  return {
    catalogue_items: [
      item('alpha', 'Alpha', { firework_id: 'f1' }),
      item('beta', 'Beta cake', { catalogue_item_kind: 'multishot', multishot_id: 'm1' }),
      item('gamma', 'Gamma', { firework_id: 'missing-firework' }),
      item('delta', 'Delta cake', { catalogue_item_kind: 'multishot', multishot_id: 'm2' }),
      item('epsilon', 'Epsilon', { firework_id: 'f1' }),
      item('zeta', 'Zeta unlisted', { firework_id: 'f1', is_listed: false }),
    ],
    supplier_inventory_items: [
      { catalogue_item_id: 'alpha', price_cents: 100, available: false },
      { catalogue_item_id: 'alpha', price_cents: 300, available: true },
      { catalogue_item_id: 'alpha', price_cents: null, available: true },
      { catalogue_item_id: 'alpha', price_cents: 200, available: true },
      { catalogue_item_id: 'beta', price_cents: 900, available: true },
    ],
    multishots: [
      { id: 'm1', shot_count: 4 },
      { id: 'm2', shot_count: 2 },
    ],
    multishot_fireworks: [
      // Deliberately out of order: assembly must sort by sequence_index.
      {
        id: 'shot-b2',
        multishot_id: 'm1',
        sequence_index: 2,
        time_offset_seconds: 1.5,
        caliber: '30mm',
        firework_id: 'f3',
        pan_degrees: 10,
        tilt_degrees: 5,
        position_override_json: null,
      },
      {
        id: 'shot-b1',
        multishot_id: 'm1',
        sequence_index: 1,
        time_offset_seconds: 0,
        caliber: '50mm',
        firework_id: 'f2',
        pan_degrees: -10,
        tilt_degrees: 0,
        position_override_json: { x: 1, y: 0, z: 2 },
      },
      {
        id: 'shot-d1',
        multishot_id: 'm2',
        sequence_index: 1,
        time_offset_seconds: 0,
        caliber: null,
        firework_id: 'f2',
        pan_degrees: 0,
        tilt_degrees: 0,
        position_override_json: null,
      },
      {
        id: 'shot-d2',
        multishot_id: 'm2',
        sequence_index: 2,
        time_offset_seconds: null,
        caliber: null,
        firework_id: 'missing-child',
        pan_degrees: 0,
        tilt_degrees: 0,
        position_override_json: null,
      },
    ],
    firework_preview_images: [
      {
        multishot_id: 'm1',
        source_revision: 3,
        renderer_version: FIREWORK_PREVIEW_RENDERER_VERSION,
        storage_path: `${FIREWORK_PREVIEW_RENDERER_VERSION}/m1.webp`,
      },
      {
        multishot_id: 'm2',
        source_revision: 1,
        renderer_version: 'stale',
        storage_path: 'stale/m2.webp',
      },
    ],
    fireworks: [firework('f1'), firework('f2'), firework('f3', { caliber: '100mm' })],
  };
}

/** Sorts like PostgREST: each `order` column in turn, numbers numerically. */
function compareRows(order) {
  return (a, b) => {
    for (const [column] of order) {
      const left = a[column];
      const right = b[column];
      if (left === right) continue;
      if (typeof left === 'number' && typeof right === 'number') return left - right;
      return String(left).localeCompare(String(right));
    }
    return 0;
  };
}

/**
 * Minimal PostgREST-style adapter: records each request and answers from
 * tables. It applies `order` and the inclusive `range`, then truncates to
 * `rowCap` the way Supabase's `max-rows` does. `failures[table]` is an error
 * object or a function of the request (to fail one page only). `delayMs`
 * keeps responses in flight so concurrency can be observed.
 */
function fakeSupabase(tables, { failures = {}, rowCap = 1000, delayMs = 0 } = {}) {
  const requests = [];
  const state = { inFlight: 0, maxInFlight: 0 };
  return {
    requests,
    state,
    from(table) {
      const request = { table, select: null, filters: [], order: [], range: null };
      requests.push(request);
      const builder = {
        select(columns) {
          request.select = columns;
          return builder;
        },
        eq(column, value) {
          request.filters.push(['eq', column, value]);
          return builder;
        },
        in(column, values) {
          request.filters.push(['in', column, values]);
          return builder;
        },
        order(column, options) {
          request.order.push([column, options]);
          return builder;
        },
        range(from, to) {
          request.range = [from, to];
          return builder;
        },
        then(resolve, reject) {
          const run = async () => {
            state.inFlight += 1;
            state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
            try {
              if (delayMs) await new Promise((tick) => setTimeout(tick, delayMs));
              const failure =
                typeof failures[table] === 'function' ? failures[table](request) : failures[table];
              if (failure) return { data: null, error: failure };
              let rows = (tables[table] ?? []).filter((row) =>
                request.filters.every(([kind, column, value]) =>
                  kind === 'eq' ? row[column] === value : value.includes(row[column]),
                ),
              );
              rows = [...rows].sort(compareRows(request.order));
              if (request.range) rows = rows.slice(request.range[0], request.range[1] + 1);
              rows = rows.slice(0, rowCap);
              return { data: rows.map((row) => ({ ...row })), error: null };
            } finally {
              state.inFlight -= 1;
            }
          };
          return run().then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

function installContext(supabase) {
  globalThis.__catalogueTest = { supabase, cache: new Map() };
  return globalThis.__catalogueTest;
}

async function loadGraph(
  supabase,
  { ids, listedOnly = true, fireworkSelect = FIREWORK_VARIANT_SELECT, include } = {},
) {
  const limiter = createReadLimiter();
  const items = await readCatalogueItems(supabase, { ids, listedOnly }, limiter);
  return readCatalogueGraph(
    supabase,
    items,
    fireworkSelect,
    include ?? {
      inventory: true,
      multishotMeta: true,
      multishotPreviews: true,
    },
    limiter,
  );
}

const PAGE = CATALOGUE_PAGE_SIZE;

/** Every request is a bounded page with a total ordering ending in a unique column. */
function assertPagedRequests(requests) {
  for (const request of requests) {
    assert.ok(request.range, `${request.table} request has no range`);
    assert.equal(request.range[1] - request.range[0] + 1, PAGE, `${request.table} page size`);
    assert.equal(request.range[0] % PAGE, 0, `${request.table} page offset`);
    assert.ok(request.order.length > 0, `${request.table} request is unordered`);
    assert.equal(request.order.at(-1)[0], 'id', `${request.table} ordering is not unique`);
  }
}

/** One cake with `shotCount` ordered shots that all reuse the fixture child firework. */
function cake(index, shotCount, tables) {
  const multishotId = `cake-m${index}`;
  tables.catalogue_items.push(
    item(`cake-${index}`, `Cake ${String(index).padStart(4, '0')}`, {
      catalogue_item_kind: 'multishot',
      multishot_id: multishotId,
    }),
  );
  tables.multishots.push({ id: multishotId, shot_count: shotCount });
  for (let shot = 0; shot < shotCount; shot += 1) {
    tables.multishot_fireworks.push({
      id: `${multishotId}-s${String(shot).padStart(4, '0')}`,
      multishot_id: multishotId,
      sequence_index: shot + 1,
      time_offset_seconds: shot * 0.25,
      caliber: '30mm',
      firework_id: 'f2',
      pan_degrees: 0,
      tilt_degrees: 0,
      position_override_json: null,
    });
  }
}

test('assembled products keep catalogue order, pricing, multishot timing and previews', async () => {
  const supabase = fakeSupabase(fixtureTables());
  const graph = await loadGraph(supabase);
  const products = assembleCatalogueProducts(graph, { lightweight: false });

  // Gamma points at a firework that does not exist, so it is skipped; Zeta is unlisted.
  assert.deepEqual(
    products.map((product) => product.id),
    ['alpha', 'beta', 'delta', 'epsilon'],
  );
  assert.deepEqual(
    products.map((product) => product.sortOrder),
    [0, 1, 2, 3],
  );

  const alpha = products[0];
  assert.equal(alpha.slug, 'PN-alpha');
  assert.equal(alpha.name, 'Alpha');
  assert.equal(alpha.manufacturer, 'Maker');
  assert.equal(alpha.description, 'Alpha description');
  assert.equal(alpha.minPriceCents, 200, 'unavailable and unpriced rows never win');
  assert.equal(alpha.shotCount, 1);
  assert.equal(alpha.previewImagePath, `${FIREWORK_PREVIEW_RENDERER_VERSION}/f1.webp`);
  assert.equal(alpha.previewImageRevision, 7);
  assert.ok(alpha.design, 'full reads carry the validated renderer design');
  assert.equal(alpha.designError, null);

  const beta = products[1];
  assert.equal(beta.shotCount, 4, 'declared shot count wins over loaded child rows');
  assert.equal(beta.caliber, '50mm', 'the first child by sequence index supplies the calibre');
  assert.equal(beta.minPriceCents, 900);
  assert.equal(beta.previewImagePath, `${FIREWORK_PREVIEW_RENDERER_VERSION}/m1.webp`);
  assert.equal(beta.previewImageRevision, 3);
  const childDuration = alpha.durationSeconds;
  assert.ok(childDuration > 0);
  assert.equal(beta.durationSeconds, 1.5 + childDuration, 'last child offset plus its duration');
  assert.equal(beta.occupancyDurationSeconds, 1.5 + alpha.occupancyDurationSeconds);
  assert.equal(beta.designError, null);

  const delta = products[2];
  assert.equal(delta.designError, 'A multishot child has no valid renderer design.');
  assert.equal(delta.previewImagePath, null, 'stale multishot posters are not served');
  assert.equal(delta.previewImageRevision, 1);
  assert.equal(delta.shotCount, 2);

  assert.equal(products[3].minPriceCents, null, 'no supplier rows means not purchasable');
});

test('lightweight products omit renderer payloads but keep card data', async () => {
  const supabase = fakeSupabase(fixtureTables());
  const graph = await loadGraph(supabase, { fireworkSelect: CATALOGUE_FIREWORK_CARD_SELECT });
  const products = assembleCatalogueProducts(graph, { lightweight: true });
  assert.deepEqual(
    products.map((product) => product.id),
    ['alpha', 'beta', 'delta', 'epsilon'],
  );
  assert.equal(products[0].renderDesign, null);
  assert.equal(products[0].rawSpec, null);
  assert.ok(products[0].design);
  assert.equal(products[1].shotCount, 4);
  assert.equal(products[0].minPriceCents, 200);
});

test('replay shots fan multishots out in order and preserve unknown timing on request', async () => {
  const supabase = fakeSupabase(fixtureTables());
  const graph = await loadGraph(supabase, {
    ids: ['alpha', 'beta', 'delta'],
    listedOnly: false,
    include: {},
  });
  const shots = assembleCatalogueItemShots(graph);

  const alpha = shots.get('alpha');
  assert.equal(alpha.length, 1);
  assert.equal(alpha[0].kind, 'direct');
  assert.equal(alpha[0].sourceCueId, 'f1-card-preview');
  assert.equal(alpha[0].timeOffsetSeconds, 0);
  assert.equal(alpha[0].panDegrees, 12);
  assert.equal(alpha[0].tiltDegrees, -4);

  const beta = shots.get('beta');
  assert.deepEqual(
    beta.map((shot) => shot.sourceCueId),
    ['shot-b1', 'shot-b2'],
  );
  assert.deepEqual(
    beta.map((shot) => shot.timeOffsetSeconds),
    [0, 1.5],
  );
  assert.deepEqual(
    beta.map((shot) => shot.firework.caliber),
    ['50mm', '30mm'],
  );
  assert.deepEqual(beta[0].positionOverride, { x: 1, y: 0, z: 2 });
  assert.equal(beta[1].panDegrees, 10);

  // The missing child is dropped; the remaining child still counts.
  assert.equal(shots.get('delta').length, 1);

  const timing = assembleCatalogueItemShots(
    await loadGraph(supabase, { ids: ['delta'], listedOnly: false, include: {} }),
    { preserveUnknownTiming: true },
  );
  assert.equal(timing.get('delta')[0].timeOffsetSeconds, 0);
  const withMissingChild = {
    ...graph,
    fireworks: [...graph.fireworks, firework('missing-child')],
  };
  const preserved = assembleCatalogueItemShots(withMissingChild, {
    preserveUnknownTiming: true,
  });
  assert.ok(Number.isNaN(preserved.get('delta')[1].timeOffsetSeconds));
});

test('the loader issues flat, batched lookups instead of one nested embed', async () => {
  const tables = fixtureTables();
  // Enough listed items and distinct fireworks to need several batches.
  for (let index = 0; index < 160; index += 1) {
    tables.catalogue_items.push(
      item(`bulk-${index}`, `Bulk ${String(index).padStart(3, '0')}`, {
        firework_id: `bulk-f${index}`,
      }),
    );
    tables.fireworks.push(firework(`bulk-f${index}`));
  }
  const supabase = fakeSupabase(tables);
  const graph = await loadGraph(supabase);

  for (const request of supabase.requests) {
    if (request.table === 'catalogue_items') {
      assert.doesNotMatch(request.select, /\(/, 'catalogue items are read without embeds');
      assert.deepEqual(request.filters, [['eq', 'is_listed', true]]);
      assert.deepEqual(request.order, [
        ['name', { ascending: true }],
        ['id', { ascending: true }],
      ]);
    }
    for (const [kind, , values] of request.filters) {
      if (kind !== 'in') continue;
      const limit =
        request.table === 'fireworks'
          ? CATALOGUE_FIREWORK_BATCH_SIZE
          : request.table === 'multishot_fireworks'
            ? CATALOGUE_SHOT_BATCH_SIZE
            : CATALOGUE_ID_BATCH_SIZE;
      assert.ok(
        values.length <= limit,
        `${request.table} batch of ${values.length} exceeds ${limit}`,
      );
      assert.equal(new Set(values).size, values.length, 'batches never repeat ids');
    }
  }
  const fireworkRequests = supabase.requests.filter((request) => request.table === 'fireworks');
  assert.ok(fireworkRequests.length >= 4, 'firework rows are split across batches');
  const requestedFireworkIds = fireworkRequests.flatMap((request) => request.filters[0][2]);
  assert.equal(
    new Set(requestedFireworkIds).size,
    requestedFireworkIds.length,
    'no firework row is fetched twice',
  );
  assertPagedRequests(supabase.requests);
  assert.equal(graph.fireworks.length, 163);
  assert.equal(graph.items.length, 165, 'the unlisted item is excluded');
  assert.deepEqual(
    supabase.requests
      .filter((request) => request.table === 'multishot_fireworks')
      .flatMap((request) => request.filters[0][2]),
    ['m1', 'm2'],
  );
});

test('scoped reads stay listed-only and keep name order across batches', async () => {
  const tables = fixtureTables();
  for (let index = 0; index < 120; index += 1) {
    tables.catalogue_items.push(
      item(`bulk-${index}`, `Bulk ${String(index).padStart(3, '0')}`, { firework_id: 'f1' }),
    );
  }
  const supabase = fakeSupabase(tables);
  const ids = [
    'zeta',
    'epsilon',
    'alpha',
    ...Array.from({ length: 120 }, (_, index) => `bulk-${index}`),
  ];
  const items = await readCatalogueItems(supabase, { ids, listedOnly: true });
  assert.equal(
    items.find((row) => row.id === 'zeta'),
    undefined,
    'unlisted ids are filtered out',
  );
  assert.deepEqual(
    items.map((row) => row.name),
    [...items.map((row) => row.name)].sort((a, b) => a.localeCompare(b)),
  );
  const itemRequests = supabase.requests.filter((request) => request.table === 'catalogue_items');
  assert.equal(itemRequests.length, 2);
  for (const request of itemRequests) {
    assert.ok(
      request.filters.some(
        ([kind, column, value]) => kind === 'eq' && column === 'is_listed' && value === true,
      ),
    );
  }
});

test('multishot-children-only reads skip the direct firework payloads', async () => {
  const supabase = fakeSupabase(fixtureTables());
  const graph = await loadGraph(supabase, {
    ids: ['alpha', 'beta'],
    listedOnly: false,
    include: { multishotChildrenOnly: true },
  });
  const fireworkIds = supabase.requests
    .filter((request) => request.table === 'fireworks')
    .flatMap((request) => request.filters[0][2]);
  assert.deepEqual(fireworkIds.sort(), ['f2', 'f3']);
  assert.equal(
    supabase.requests.some((request) => request.table === 'supplier_inventory_items'),
    false,
  );
  assert.deepEqual(assembleCatalogueItemShots(graph).get('beta').length, 2);
});

test('any failing table read throws instead of shrinking the catalogue', async (context) => {
  const logged = [];
  context.mock.method(console, 'error', (...args) => logged.push(args));
  for (const table of [
    'catalogue_items',
    'supplier_inventory_items',
    'multishots',
    'multishot_fireworks',
    'firework_preview_images',
    'fireworks',
  ]) {
    const supabase = fakeSupabase(fixtureTables(), {
      failures: {
        [table]: { code: '57014', message: 'canceling statement due to statement timeout' },
      },
    });
    await assert.rejects(loadGraph(supabase), (error) => {
      assert.ok(error instanceof CatalogueReadError, `${table}: ${error?.constructor?.name}`);
      assert.equal(error.message, 'The firework catalogue could not be loaded.');
      assert.equal(error.cause.code, '57014', 'the database code stays on the cause for logs');
      assert.equal(error.table, table);
      return true;
    });
  }
  const network = fakeSupabase(fixtureTables(), {
    failures: { fireworks: { message: 'TypeError: fetch failed' } },
  });
  await assert.rejects(loadGraph(network), ShowsNetworkError);
  const diagnostics = logged.map((args) => JSON.stringify(args[1]));
  assert.ok(diagnostics.some((entry) => entry.includes('57014') && entry.includes('multishots')));
});

test('listFireworkProducts propagates read failures on every path and caches good reads once', async (context) => {
  context.mock.method(console, 'error', () => {});
  const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };

  // Full read: a database failure is a thrown error, not an empty catalogue.
  installContext(fakeSupabase(fixtureTables(), { failures: { fireworks: timeout } }));
  await assert.rejects(listFireworkProducts(), CatalogueReadError);

  // Lightweight read: same contract.
  installContext(fakeSupabase(fixtureTables(), { failures: { multishot_fireworks: timeout } }));
  await assert.rejects(listFireworkProducts({ lightweight: true }), CatalogueReadError);

  // Scoped read uses the caller's client, bypasses the cache and still fails loudly.
  const scopedFailure = fakeSupabase(fixtureTables(), {
    failures: { supplier_inventory_items: timeout },
  });
  const scopedContext = installContext(fakeSupabase({}));
  await assert.rejects(
    listFireworkProducts({ scopedRead: { supabase: scopedFailure, ids: ['alpha'] } }),
    CatalogueReadError,
  );
  assert.equal(scopedContext.cache.size, 0);
  assert.equal(
    scopedContext.supabase.requests.length,
    0,
    'scoped reads never touch the shared client',
  );

  // Healthy full read: mapped products and a single cache write.
  const healthy = installContext(fakeSupabase(fixtureTables()));
  const products = await listFireworkProducts();
  assert.deepEqual(
    products.map((product) => product.id),
    ['alpha', 'beta', 'delta', 'epsilon'],
  );
  assert.equal(healthy.cache.size, 1);
  const [cached] = [...healthy.cache.values()];
  assert.equal(cached.length, 4);
  assert.ok(
    healthy.supabase.requests.some((request) => request.table === 'supplier_inventory_items'),
  );

  // Scoped healthy read: listed filter plus id filter, no cache write.
  const scoped = installContext(fakeSupabase({}));
  const scopedClient = fakeSupabase(fixtureTables());
  const scopedProducts = await listFireworkProducts({
    scopedRead: { supabase: scopedClient, ids: ['beta', 'zeta'] },
  });
  assert.deepEqual(
    scopedProducts.map((product) => product.id),
    ['beta'],
  );
  assert.equal(scopedProducts[0].shotCount, 4);
  assert.equal(scoped.cache.size, 0);
  const scopedItemRequest = scopedClient.requests.find(
    (request) => request.table === 'catalogue_items',
  );
  assert.deepEqual(scopedItemRequest.filters, [
    ['in', 'id', ['beta', 'zeta']],
    ['eq', 'is_listed', true],
  ]);

  // An empty catalogue is still a genuine empty list.
  installContext(fakeSupabase({ catalogue_items: [] }));
  assert.deepEqual(await listFireworkProducts({ lightweight: true }), []);
});

test('fetchShotsByCatalogueItem fails every consumer loudly rather than replaying silence', async (context) => {
  context.mock.method(console, 'error', () => {});
  const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };

  // Public replay path (no options): a database failure is still a failure.
  const replay = fakeSupabase(fixtureTables(), { failures: { multishot_fireworks: timeout } });
  await assert.rejects(fetchShotsByCatalogueItem(replay, ['alpha', 'beta']), (error) => {
    assert.ok(error instanceof CatalogueReadError);
    assert.equal(error.cause.code, '57014');
    return true;
  });

  // Timing and card-preview paths share the same contract.
  const strict = fakeSupabase(fixtureTables(), { failures: { multishot_fireworks: timeout } });
  await assert.rejects(
    fetchShotsByCatalogueItem(strict, ['alpha', 'beta'], {
      preserveUnknownTiming: true,
      multishotChildrenOnly: true,
    }),
    CatalogueReadError,
  );

  const network = fakeSupabase(fixtureTables(), {
    failures: { fireworks: { message: 'fetch failed' } },
  });
  await assert.rejects(fetchShotsByCatalogueItem(network, ['alpha']), ShowsNetworkError);

  // Replay reads unlisted items too, since saved shows may reference them.
  const healthy = fakeSupabase(fixtureTables());
  const shots = await fetchShotsByCatalogueItem(healthy, ['zeta', 'beta'], {
    multishotChildrenOnly: true,
    preserveUnknownTiming: true,
  });
  assert.equal(shots.has('zeta'), false, 'direct items are skipped when only children are needed');
  assert.equal(shots.get('beta').length, 2);
  const itemRequest = healthy.requests.find((request) => request.table === 'catalogue_items');
  assert.equal(
    itemRequest.filters.some(([, column]) => column === 'is_listed'),
    false,
  );
  const full = await fetchShotsByCatalogueItem(fakeSupabase(fixtureTables()), ['zeta']);
  assert.equal(full.get('zeta')[0].kind, 'direct', 'unlisted saved items still replay');
  assert.equal(await fetchShotsByCatalogueItem(healthy, []).then((map) => map.size), 0);
});

test('high fan-out relations are read page by page until a short page, never truncated', async () => {
  const tables = fixtureTables();
  // One shot batch (20 cakes) carrying 1200 shot rows: more than the 1000-row API cap.
  for (let index = 0; index < 20; index += 1) cake(index, 60, tables);
  const supabase = fakeSupabase(tables, { rowCap: 1000 });
  const graph = await loadGraph(supabase);

  assertPagedRequests(supabase.requests);
  assert.equal(graph.shots.length, 1200 + 4);
  const shotRequests = supabase.requests.filter(
    (request) => request.table === 'multishot_fireworks',
  );
  const bulkPages = shotRequests
    .filter((request) => request.filters[0][2].includes('cake-m0'))
    .map((request) => request.range);
  assert.deepEqual(bulkPages, [
    [0, PAGE - 1],
    [PAGE, 2 * PAGE - 1],
    [2 * PAGE, 3 * PAGE - 1],
  ]);
  assert.deepEqual(
    shotRequests[0].order.map(([column]) => column),
    ['multishot_id', 'sequence_index', 'id'],
  );

  const products = assembleCatalogueProducts(graph, { lightweight: false });
  const cakes = products.filter((product) => product.id.startsWith('cake-'));
  assert.equal(cakes.length, 20, 'every cake survives the page walk');
  for (const product of cakes) {
    assert.equal(product.shotCount, 60);
    // The last shot (offset 14.75s) sits on the final page; without it the cake would end early.
    assert.ok(product.durationSeconds > 59 * 0.25, `${product.id} lost its late shots`);
    assert.equal(product.durationSeconds, cakes[0].durationSeconds);
    assert.equal(product.designError, null);
  }
});

test('an exact page boundary and an empty relation both finish cleanly', async () => {
  const tables = fixtureTables();
  // Exactly one full page of shots in a single batch, plus a cake with no shot rows yet.
  for (let index = 0; index < 10; index += 1) cake(index, PAGE / 10, tables);
  cake(99, 0, tables);
  const supabase = fakeSupabase(tables);
  const graph = await loadGraph(supabase, {
    ids: Array.from({ length: 10 }, (_, index) => `cake-${index}`).concat('cake-99'),
  });

  const pages = supabase.requests
    .filter((request) => request.table === 'multishot_fireworks')
    .map((request) => [request.filters[0][2].length, request.range]);
  assert.deepEqual(pages, [
    [11, [0, PAGE - 1]],
    [11, [PAGE, 2 * PAGE - 1]],
  ]);
  assert.equal(graph.shots.length, PAGE);
  const products = assembleCatalogueProducts(graph, { lightweight: false });
  assert.deepEqual(
    products.map((product) => product.shotCount),
    Array.from({ length: 10 }, () => PAGE / 10),
  );
  // A cake with no shot rows has no primary firework, so it is skipped rather than invented.
  assert.equal(
    products.some((product) => product.id === 'cake-99'),
    false,
  );
  assert.equal(assembleCatalogueItemShots(graph).has('cake-99'), false);
});

test('a failure on a later page fails the whole read and nothing partial is cached', async (context) => {
  context.mock.method(console, 'error', () => {});
  const tables = fixtureTables();
  for (let index = 0; index < 20; index += 1) cake(index, 60, tables);
  const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };
  const supabase = fakeSupabase(tables, {
    failures: { multishot_fireworks: (request) => (request.range[0] >= PAGE ? timeout : null) },
  });
  const test = installContext(supabase);

  await assert.rejects(listFireworkProducts(), (error) => {
    assert.ok(error instanceof CatalogueReadError);
    assert.equal(error.table, 'multishot_fireworks');
    assert.equal(error.cause.code, '57014');
    return true;
  });
  assert.equal(test.cache.size, 0, 'a truncated graph never reaches the cache');
  const firstPage = supabase.requests.find(
    (request) => request.table === 'multishot_fireworks' && request.range[0] === 0,
  );
  assert.ok(firstPage, 'the first page was read before the failure');
});

test('an unscoped catalogue beyond the row cap is read in name-ordered pages', async () => {
  const tables = fixtureTables();
  for (let index = 0; index < 1100; index += 1) {
    tables.catalogue_items.push(
      item(`bulk-${index}`, `Bulk ${String(index).padStart(4, '0')}`, { firework_id: 'f1' }),
    );
    tables.supplier_inventory_items.push({
      id: `inv-${index}`,
      catalogue_item_id: `bulk-${index}`,
      price_cents: 100 + index,
      available: true,
    });
  }
  const supabase = fakeSupabase(tables, { rowCap: 1000 });
  const graph = await loadGraph(supabase);

  const itemPages = supabase.requests
    .filter((request) => request.table === 'catalogue_items')
    .map((request) => request.range);
  assert.deepEqual(itemPages, [
    [0, PAGE - 1],
    [PAGE, 2 * PAGE - 1],
    [2 * PAGE, 3 * PAGE - 1],
  ]);
  assert.equal(graph.items.length, 1105, 'all listed items beyond the API cap are present');
  assert.deepEqual(
    graph.items.map((row) => row.name),
    [...graph.items.map((row) => row.name)].sort((a, b) => a.localeCompare(b)),
  );
  assert.equal(
    supabase.requests.filter((request) => request.table === 'supplier_inventory_items').length,
    Math.ceil(1105 / CATALOGUE_ID_BATCH_SIZE),
  );
  const products = assembleCatalogueProducts(graph, { lightweight: true });
  assert.equal(products.length, 1104);
  assert.equal(products.find((product) => product.id === 'bulk-1099').minPriceCents, 1199);
});

test('supplier inventory fan-out beyond one page still finds the cheapest available price', async () => {
  const tables = fixtureTables();
  tables.supplier_inventory_items = [];
  // 100 items with 6 offers each: 600 rows in one id batch, so two pages.
  for (let index = 0; index < 100; index += 1) {
    tables.catalogue_items.push(
      item(`bulk-${index}`, `Bulk ${String(index).padStart(3, '0')}`, { firework_id: 'f1' }),
    );
    for (let offer = 0; offer < 6; offer += 1) {
      tables.supplier_inventory_items.push({
        id: `inv-${String(index).padStart(3, '0')}-${offer}`,
        catalogue_item_id: `bulk-${index}`,
        price_cents: 1000 - offer * (index === 99 ? 100 : 1),
        available: offer !== 5 || index !== 50,
      });
    }
  }
  const supabase = fakeSupabase(tables);
  const graph = await loadGraph(supabase, {
    ids: Array.from({ length: 100 }, (_, index) => `bulk-${index}`),
  });

  const inventoryPages = supabase.requests
    .filter((request) => request.table === 'supplier_inventory_items')
    .map((request) => request.range);
  assert.deepEqual(inventoryPages, [
    [0, PAGE - 1],
    [PAGE, 2 * PAGE - 1],
  ]);
  assert.equal(graph.inventory.length, 600);
  const products = assembleCatalogueProducts(graph, { lightweight: true });
  // The last item's cheapest offer lives on the second page.
  assert.equal(products.find((product) => product.id === 'bulk-99').minPriceCents, 500);
  assert.equal(products.find((product) => product.id === 'bulk-50').minPriceCents, 996);
});

test('requests across every table share one in-flight cap', async () => {
  const tables = fixtureTables();
  for (let index = 0; index < 400; index += 1) {
    tables.catalogue_items.push(
      item(`bulk-${index}`, `Bulk ${String(index).padStart(3, '0')}`, {
        firework_id: `bulk-f${index}`,
      }),
    );
    tables.fireworks.push(firework(`bulk-f${index}`));
  }
  for (let index = 0; index < 60; index += 1) cake(index, 30, tables);
  const supabase = fakeSupabase(tables, { delayMs: 2 });
  const context = installContext(supabase);

  const products = await listFireworkProducts();
  assert.ok(supabase.requests.length > 20, 'the read spans many batches and pages');
  assert.ok(supabase.state.maxInFlight > 1, 'batches run side by side');
  assert.ok(
    supabase.state.maxInFlight <= CATALOGUE_READ_CONCURRENCY,
    `${supabase.state.maxInFlight} requests were in flight at once`,
  );
  assert.equal(products.length, 400 + 60 + 4);
  assert.equal(context.cache.size, 1);

  // The limiter itself: bounded, order-preserving, and it releases on failure.
  const limiter = createReadLimiter(2);
  let active = 0;
  let peak = 0;
  const tasks = Array.from({ length: 5 }, (_, index) =>
    limiter(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((tick) => setTimeout(tick, 1));
      active -= 1;
      if (index === 2) throw new Error('boom');
      return index;
    }),
  );
  const settled = await Promise.allSettled(tasks);
  assert.equal(peak, 2);
  assert.deepEqual(
    settled.map((entry) => (entry.status === 'fulfilled' ? entry.value : 'x')),
    [0, 1, 'x', 3, 4],
  );
  assert.equal(await limiter(async () => 'after'), 'after');
});
