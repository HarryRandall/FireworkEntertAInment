/** Public destinations, payload validation and deterministic composition playback. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates } from '@showcrafter/fireworks';
import { shotDuration } from '@showcrafter/fireworks/sim';
import { productShots, showShots } from '../lib/shopper/playback.ts';
import { qrDestination, formatPrice } from '../lib/shopper/paths.ts';
import { playbackSchema } from '../lib/shopper/contracts.ts';

const design = effectTemplates.find((entry) => entry.key === 'peony').design;
const product = {
  id: '60000000-0000-4000-8000-000000000001',
  name: 'Test cake',
  kind: 'cake',
  version_id: '70000000-0000-4000-8000-000000000001',
  poster: null,
  composition: {
    box: { rows: 1, cols: 2, pitch_mm: 100 },
    tubes: [
      { i: 0, letter: 'a', t_ms: 0, angle_deg: -15, pos: [0, 0], seed: 7 },
      { i: 1, letter: 'a', t_ms: 1250, angle_deg: 15, pos: [0, 1], seed: 9 },
    ],
  },
  effects: [{ letter: 'a', design, renderer: '1.0.0' }],
  pack_items: [],
};
test('every QR target has a safe local destination with context preserved', () => {
  const base = '/shopper/stores/leeds';
  assert.equal(qrDestination('leeds', 'store', null), base);
  assert.equal(qrDestination('leeds', 'planner', null), `${base}/plan`);
  for (const kind of ['product', 'pack'])
    assert.equal(qrDestination('leeds', kind, product.id), `${base}/products/${product.id}`);
  assert.equal(qrDestination('leeds', 'show', product.id), `${base}/shows/${product.id}`);
  assert.equal(
    qrDestination('leeds', 'collection', product.id),
    `${base}?collection=${product.id}#collections`,
  );
  assert.equal(
    qrDestination('https://bad.test', 'store', null),
    '/shopper/stores/https%3A%2F%2Fbad.test',
  );
  assert.throws(() => qrDestination('leeds', 'product', null));
  assert.throws(() => qrDestination('leeds', 'unknown', null));
});
test('currency display converts minor units once for all enabled currencies', () => {
  assert.equal(formatPrice(1999, 'GBP'), '£19.99');
  assert.match(formatPrice(1999, 'USD'), /19\.99/);
  assert.equal(formatPrice(1999, 'EUR'), '€19.99');
  assert.match(formatPrice(1999, 'AUD'), /19\.99/);
});
test('cake playback preserves tube clocks, seeded fans and physical box pitch without mutation', () => {
  const before = structuredClone(product);
  const shots = productShots(product, 2, 3, 5);
  assert.deepEqual(
    shots.map((shot) => shot.t0),
    [2, 3.25],
  );
  assert.deepEqual(
    shots.map((shot) => shot.position),
    [
      [2.95, 0],
      [3.05, 0],
    ],
  );
  assert.deepEqual(
    shots.map((shot) => shot.seed),
    [7, 9],
  );
  assert.deepEqual(
    shots.map((shot) => shot.design.launch.tilt_deg),
    [design.launch.tilt_deg - 10, design.launch.tilt_deg + 20],
  );
  assert.deepEqual(productShots(product, 2, 3, 5), shots);
  assert.deepEqual(product, before);
});
test('show cues resolve the product at milliseconds from show start', () => {
  const show = {
    products: [{ quantity: 1, product }],
    cues: [{ t_ms: 4500, product_id: product.id, position: -2, angle_deg: 0 }],
  };
  assert.equal(showShots(show)[0].t0, 4.5);
  assert.deepEqual(showShots(show)[0].position, [-2.05, 0]);
  assert.throws(() => showShots({ ...show, products: [] }), /no visible product/);
});
test('selection pack quantities play sequentially rather than multiplying simultaneous shots', () => {
  const pack = {
    ...product,
    kind: 'pack',
    composition: null,
    effects: [],
    pack_items: [{ quantity: 2, product }],
  };
  const shots = productShots(pack);
  assert.equal(shots.length, 4);
  const firstEnd = Math.max(
    ...shots.slice(0, 2).map((shot) => shot.t0 + shotDuration(shot.design)),
  );
  assert.equal(shots[2].t0, firstEnd);
});
test('public documents reject malformed designs, storage traversal and missing effect bindings', () => {
  assert.equal(playbackSchema.safeParse(product).success, true);
  assert.equal(
    playbackSchema.safeParse({
      ...product,
      effects: [{ letter: 'a', design: {}, renderer: 'test' }],
    }).success,
    false,
  );
  assert.equal(
    playbackSchema.safeParse({ ...product, poster: { path: '../private.png', renderer: 'test' } })
      .success,
    false,
  );
  assert.throws(() => productShots({ ...product, effects: [] }), /Missing published design/);
});
