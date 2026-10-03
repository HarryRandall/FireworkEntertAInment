/** Catalogue posters resolve actual composition data without mutating renderer designs. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates } from '@showcrafter/fireworks';
import { effectPreview, productPreview } from '../lib/catalogue/preview.ts';

test('product poster resolves timing, lean, seed and centred box position', () => {
  const source = structuredClone(effectTemplates[0].design);
  const original = structuredClone(source);
  const preview = productPreview(
    {
      box: { rows: 1, cols: 3, pitch_mm: 40 },
      tubes: [{ i: 0, letter: 'a', t_ms: 2500, angle_deg: -20, pos: [0, 0], seed: 7 }],
    },
    new Map([['a', effectPreview(source)]]),
  );
  assert.equal(preview.shots[0].t0, 2.5);
  assert.equal(preview.shots[0].seed, 7);
  assert.deepEqual(preview.shots[0].position, [-0.04, 0]);
  assert.equal(preview.shots[0].design.launch.tilt_deg, source.launch.tilt_deg - 20);
  assert.deepEqual(source, original);
});
test('invalid documents and missing bindings fail visibly', () => {
  assert.throws(() => effectPreview({}));
  assert.throws(
    () => productPreview({ tubes: [{ i: 0, letter: 'a', t_ms: 0, angle_deg: 0 }] }, new Map()),
    /Missing published effect/,
  );
});
test('empty composition has no invented preview; untimed items start together', () => {
  assert.equal(productPreview({ tubes: [] }, new Map()), null);
  const preview = productPreview(
    { tubes: [{ i: 0, letter: 'a', t_ms: null, angle_deg: 0 }] },
    new Map([['a', effectPreview(effectTemplates[0].design)]]),
  );
  assert.equal(preview.shots[0].t0, 0);
});

test('usage propagates through nested packs and terminates on repeated dependencies', async () => {
  const { dependentProductIds } = await import('../lib/catalogue/usage.ts');
  const data = {
    products: [
      { id: 'cake', current_version_id: 'published' },
      { id: 'other', current_version_id: 'unrelated' },
    ],
    bindings: [
      { product_version_id: 'published', effect_id: 'peony' },
      { product_version_id: 'old', effect_id: 'peony' },
    ],
    packs: [
      { item_id: 'cake', pack_id: 'pack' },
      { item_id: 'pack', pack_id: 'outer' },
      { item_id: 'outer', pack_id: 'pack' },
    ],
  };
  assert.deepEqual([...dependentProductIds(data, 'effect', 'peony')], ['cake', 'pack', 'outer']);
  assert.deepEqual([...dependentProductIds(data, 'product', 'other')], ['other']);
});
