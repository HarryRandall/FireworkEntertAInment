/** Behaviour of the pure catalogue filter, sort, facet and related-product helpers. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  catalogueFacets,
  catalogueHref,
  catalogueProductSummary,
  isReadableDescription,
  colourFamily,
  matchesCatalogueFilters,
  parseCatalogueFilters,
  relatedCatalogueProducts,
  sortCatalogueProducts,
} = await import('../../lib/catalogue-browse.ts');

function product(overrides) {
  return {
    id: overrides.id,
    slug: overrides.id,
    name: overrides.name ?? overrides.id,
    description: null,
    durationSeconds: 4,
    heightMeters: 60,
    caliber: '30mm',
    shotCount: 1,
    manufacturer: null,
    minPriceCents: 1000,
    baseEffect: { id: 'peony', slug: 'peony', name: 'Peony', patternKey: 'peony' },
    variant: {
      id: overrides.id,
      slug: overrides.id,
      primaryColor: '#ff0000',
      secondaryColor: null,
      colorPalette: [],
    },
    ...overrides,
  };
}

const ring = product({
  id: 'silver-ring',
  name: 'Silver Ring',
  caliber: '50mm',
  minPriceCents: 2500,
  heightMeters: 90,
  baseEffect: { id: 'ring', slug: 'ring', name: 'Ring', patternKey: 'ring' },
  variant: {
    id: 'r',
    slug: 'r',
    primaryColor: '#d9d9d9',
    secondaryColor: '#3a86ff',
    colorPalette: [],
  },
});
const redPeony = product({ id: 'red-peony', name: 'Red Peony' });
const blueStrobeCake = product({
  id: 'blue-cake',
  name: 'Blue Strobe Cake',
  shotCount: 25,
  minPriceCents: null,
  durationSeconds: 30,
  baseEffect: { id: 'strobe', slug: 'strobe', name: 'Strobe', patternKey: 'strobe' },
  variant: {
    id: 'b',
    slug: 'b',
    primaryColor: '#1e3cff',
    secondaryColor: null,
    colorPalette: ['#ffffff'],
  },
});
const all = [ring, redPeony, blueStrobeCake];

test('colour families bucket hex colours the way a shopper would search', () => {
  assert.equal(colourFamily('#ff0000'), 'red');
  assert.equal(colourFamily('#1e3cff'), 'blue');
  assert.equal(colourFamily('#ffd700'), 'gold');
  assert.equal(colourFamily('#d9d9d9'), 'white');
  assert.equal(colourFamily('#22cc44'), 'green');
  assert.equal(colourFamily('#9d4edd'), 'purple');
  assert.equal(colourFamily('not-a-colour'), null);
});

test('filters combine effect, colour, calibre, kind and price', () => {
  const filters = (params) => parseCatalogueFilters(params);
  const ids = (params) =>
    all.filter((item) => matchesCatalogueFilters(item, filters(params))).map((item) => item.id);

  assert.deepEqual(ids({ colour: 'blue' }), ['silver-ring', 'blue-cake']);
  assert.deepEqual(ids({ colour: 'blue', kind: 'multishot' }), ['blue-cake']);
  assert.deepEqual(ids({ effect: 'ring' }), ['silver-ring']);
  assert.deepEqual(ids({ caliber: '30mm' }), ['red-peony', 'blue-cake']);
  // Unpriced products cannot satisfy a price ceiling.
  assert.deepEqual(ids({ price_max: '20' }), ['red-peony']);
  assert.deepEqual(ids({ q: 'strobe' }), ['blue-cake']);
});

test('invalid parameters fall back to safe defaults', () => {
  const filters = parseCatalogueFilters({ sort: 'nonsense', price_max: '-4', duration_min: 'x' });
  assert.equal(filters.sort, 'name');
  assert.equal(filters.priceMaxCents, null);
  assert.equal(filters.durationMin, null);
});

test('sorting keeps unknown values last', () => {
  assert.deepEqual(
    sortCatalogueProducts(all, 'price-asc').map((item) => item.id),
    ['red-peony', 'silver-ring', 'blue-cake'],
  );
  assert.deepEqual(
    sortCatalogueProducts(all, 'price-desc').map((item) => item.id),
    ['silver-ring', 'red-peony', 'blue-cake'],
  );
  assert.equal(sortCatalogueProducts(all, 'shots-desc')[0].id, 'blue-cake');
  assert.equal(sortCatalogueProducts(all, 'height-desc')[0].id, 'silver-ring');
});

test('facets ignore their own selection so siblings stay pickable', () => {
  const facets = catalogueFacets(all, parseCatalogueFilters({ effect: 'ring' }));
  assert.deepEqual(facets.effects.map((effect) => effect.value).sort(), [
    'peony',
    'ring',
    'strobe',
  ]);
  // Colours are narrowed by the active effect.
  assert.deepEqual(
    facets.colours.map((colour) => colour.value),
    ['blue', 'white'],
  );
  assert.deepEqual(
    facets.calibers.map((caliber) => caliber.value),
    ['50mm'],
  );
});

test('related products prefer shared effect and colour', () => {
  const blueRing = product({
    id: 'blue-ring',
    baseEffect: ring.baseEffect,
    variant: {
      id: 'x',
      slug: 'x',
      primaryColor: '#3a86ff',
      secondaryColor: null,
      colorPalette: [],
    },
  });
  const related = relatedCatalogueProducts(ring, [...all, blueRing]);
  assert.equal(related[0].id, 'blue-ring');
  assert.ok(!related.some((item) => item.id === ring.id));
});

test('catalogue links reset paging and drop cleared values', () => {
  assert.equal(
    catalogueHref({ q: 'ring', page: '3', colour: 'blue' }, { colour: null }),
    '/catalogue?q=ring',
  );
  assert.equal(catalogueHref({}, { effect: 'ring' }), '/catalogue?effect=ring');
  assert.equal(catalogueHref({}, {}), '/catalogue');
});

test('product summaries read as plain English and raw supplier codes are detected', () => {
  assert.equal(
    catalogueProductSummary(blueStrobeCake),
    'A 25-shot strobe cake in 30mm, firing blue and silver.',
  );
  assert.equal(
    catalogueProductSummary(ring),
    'A single ring shell in 50mm, firing silver and blue.',
  );
  assert.equal(isReadableDescription('Bright gold willow with crackling tips.'), true);
  assert.equal(
    isReadableDescription(
      'Willow w/ Pistil Aerial, 1 Row (0a3667/b/c/a/b/c/a3666/b/c/-1d75/0e74/1f/CAK)',
    ),
    false,
  );
  assert.equal(isReadableDescription(null), false);
});
