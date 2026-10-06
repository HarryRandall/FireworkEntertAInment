import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { buildFinale3dCsv, finaleExportWarning } from '../../lib/finale3d.ts';
import { readCsv } from '../../lib/finale/csv.ts';

// Execute the actual route with request/session/database boundaries replaced;
// no database or network connection is created by this harness.
const source = stripTypeScriptTypes(
  readFileSync(new URL('../../app/api/shows/[id]/export/route.ts', import.meta.url), 'utf8'),
)
  .replace(/^import[\s\S]*?;$/gm, '')
  .replace('export async function GET', 'async function GET');
const routeFactory = new Function(
  'cookies',
  'NextResponse',
  'createClient',
  'getShowBySlug',
  'buildFinale3dCsv',
  'finaleExportWarning',
  `${source}\nreturn GET;`,
);
const products = Array.from({ length: 501 }, (_, index) => ({
  id: `product-${index}`,
  part_number: `SUPPLIER-${index}`,
  name: `Effect ${index}`,
  finale_product_id: index % 2 ? null : `FINALE-${index}`,
  finale_effect_name: index === 0 ? 'Finale name' : null,
  manufacturer: null,
  firework_type: 'shell',
  duration_seconds: 5,
  description: null,
  fireworks: { caliber: '30mm' },
  multishots: null,
}));
const cues = Array.from({ length: 1250 }, (_, index) => ({
  time_seconds: index / 10,
  catalogue_item_id: products[index % products.length].id,
  launch_position_index: index % 3,
}));

function route({ failCuesAfter = Infinity, failCatalogue = false, missingProduct = false } = {}) {
  const reads = [];
  const client = {
    from(table) {
      let from = 0;
      let to = Infinity;
      let ids = [];
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        not() {
          return query;
        },
        order() {
          return query;
        },
        range(start, end) {
          from = start;
          to = end;
          return query;
        },
        in(_column, values) {
          ids = values;
          return query;
        },
        then(resolve, reject) {
          reads.push({ table, from, to, ids });
          const error =
            (table === 'show_timeline_items' && from >= failCuesAfter) ||
            (table === 'catalogue_items' && failCatalogue)
              ? { message: 'Read failed' }
              : null;
          const data =
            table === 'show_timeline_items'
              ? cues.slice(from, to + 1)
              : products.filter(
                  (product) =>
                    ids.includes(product.id) && (!missingProduct || product.id !== products[0].id),
                );
          return Promise.resolve({ data: error ? null : data, error }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return {
    get: routeFactory(
      async () => ({}),
      Response,
      () => client,
      async () => ({ id: 'show', title: 'Sample show' }),
      buildFinale3dCsv,
      finaleExportWarning,
    ),
    reads,
  };
}
const params = { params: Promise.resolve({ id: 'sample' }) };
const request = (query = '') => new Request(`https://example.test/api/shows/sample/export${query}`);

test('actual route warns for all unmatched cues beyond one API page, then exports every cue', async () => {
  const { get, reads } = route();
  const warningResponse = await get(request(), params);
  const warning = await warningResponse.json();
  const expectedCount = cues.filter(
    (cue) => !products.find((product) => product.id === cue.catalogue_item_id).finale_product_id,
  ).length;
  assert.equal(warning.kind, 'unmatched');
  assert.equal(warning.cueCount, expectedCount);
  assert.equal(reads.filter((read) => read.table === 'show_timeline_items').length, 3);
  assert.equal(reads.filter((read) => read.table === 'catalogue_items').length, 2);
  const download = await get(request('?continue=1'), params);
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-type'), /text\/csv/);
  const rows = readCsv(await download.text());
  assert.equal(rows.length, cues.length + 1);
  assert.equal(rows[1][10], 'Finale name');
  assert.equal(rows[1][21], 'FINALE-0');
  assert.equal(rows[2][21], '');
  assert.equal(rows[2][20], 'No Finale 3D equivalent');
  assert.equal(rows.at(-1)[2], cues.at(-1).time_seconds.toFixed(3));
});

test('actual route rejects failed later cue pages, catalogue reads and unresolved references', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await route({ failCuesAfter: 500 }).get(request(), params)).status, 500);
    assert.equal((await route({ failCatalogue: true }).get(request(), params)).status, 500);
    assert.equal((await route({ missingProduct: true }).get(request(), params)).status, 409);
  } finally {
    console.error = originalError;
  }
});
