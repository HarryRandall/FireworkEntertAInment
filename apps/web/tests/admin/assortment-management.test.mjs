import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Run the real read functions against an in-memory query adapter. This verifies
// error/permission behaviour without depending on a hosted database or cookies.
function loadReads({ allowed = true, data = [], error = null } = {}) {
  const calls = [];
  const query = new Proxy(
    {},
    {
      get(_target, method) {
        if (method === 'then') return (resolve) => resolve({ data, error });
        return (...args) => {
          calls.push([method, ...args]);
          return query;
        };
      },
    },
  );
  const dependencies = {
    'server-only': {},
    'next/headers': { cookies: async () => ({}) },
    '@/lib/admin/current-user.server': {
      requirePermission: async () => (allowed ? { id: 'user' } : null),
    },
    '@/lib/supabase/server': { createClient: () => query },
  };
  const source = readFileSync(
    new URL('../../lib/admin/assortments.server.ts', import.meta.url),
    'utf8',
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function('require', 'exports', outputText)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return { reads: exports, calls };
}

test('assortment reads distinguish database failure from empty and missing data', async (context) => {
  context.mock.method(console, 'error', () => {});
  for (const [method, argument] of [
    ['listAssortments'],
    ['getAssortmentById', 'assortment'],
    ['searchCatalogueItemOptions', 'comet'],
  ]) {
    const { reads } = loadReads({ error: new Error('database unavailable') });
    await assert.rejects(reads[method](argument), /could not be loaded/);
  }
  assert.deepEqual(await loadReads().reads.listAssortments(), []);
  assert.equal(await loadReads({ data: null }).reads.getAssortmentById('missing'), null);
});

test('assortment reads reject unauthorised callers before accessing the database', async () => {
  const { reads, calls } = loadReads({ allowed: false });
  await assert.rejects(reads.listAssortments(), /Not permitted/);
  await assert.rejects(reads.getAssortmentById('assortment'), /Not permitted/);
  await assert.rejects(reads.searchCatalogueItemOptions('comet'), /Not permitted/);
  assert.equal(calls.length, 0);
});

test('catalogue options exclude unavailable prices and retain products without prices', async () => {
  const { reads } = loadReads({
    data: [
      {
        id: 'one',
        name: 'Comet',
        part_number: 'C1',
        supplier_inventory_items: [
          { price_cents: 100, available: false },
          { price_cents: 300, available: true },
          { price_cents: null, available: true },
          { price_cents: 200, available: true },
        ],
      },
      { id: 'two', name: 'Peony', part_number: 'P1', supplier_inventory_items: [] },
    ],
  });
  const options = await reads.searchCatalogueItemOptions('');
  assert.equal(options[0].cheapestPriceCents, 200);
  assert.equal(options[1].cheapestPriceCents, null);
});
