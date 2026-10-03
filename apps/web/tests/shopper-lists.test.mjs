/** Price snapshot totals and external account payload boundaries. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import JsBarcode from 'jsbarcode';
import { listTotal } from '../lib/shopper/lists/totals.ts';
import { listSchema } from '../lib/shopper/lists/contracts.ts';
const item = {
  product_id: '10000000-0000-4000-8000-000000000001',
  name: 'Fixture product',
  quantity: 3,
  unit_price_minor: 1999,
  currency: 'GBP',
};
test('list totals multiply quantities by saved minor units and preserve currency', () => {
  assert.deepEqual(listTotal([item, { ...item, quantity: 2, unit_price_minor: 1200 }]), {
    minor: 8397,
    currency: 'GBP',
  });
  for (const currency of ['USD', 'EUR', 'AUD'])
    assert.deepEqual(listTotal([{ ...item, currency }]), { minor: 5997, currency });
  assert.equal(listTotal([]), null);
});
test('mixed currencies and imprecise monetary totals remain visible failures', () => {
  assert.throws(() => listTotal([item, { ...item, currency: 'USD' }]), /currencies/);
  assert.throws(
    () => listTotal([{ ...item, unit_price_minor: Number.MAX_SAFE_INTEGER }]),
    /precision/,
  );
});
test('till identifiers reject malformed codes before display', () => {
  const list = {
    id: item.product_id,
    store_id: item.product_id,
    store_name: 'Fixture shop',
    store_slug: 'fixture',
    organisation_id: item.product_id,
    till_code: '0011223344556677',
    valid_until: '2026-12-31',
    status: 'open',
    items: [item],
  };
  assert.equal(listSchema.parse(list).till_code, '0011223344556677');
  for (const till_code of ['123', '001122334455667x', '001122334455667788'])
    assert.equal(listSchema.safeParse({ ...list, till_code }).success, false);
});
test('Code 128 C encodes the exact sixteen digits and produces distinct bar patterns', () => {
  const first = {};
  const second = {};
  JsBarcode(first, '0011223344556677', { format: 'CODE128C' });
  JsBarcode(second, '0011223344556678', { format: 'CODE128C' });
  assert.equal(first.encodings[0].text, '0011223344556677');
  assert.match(first.encodings[0].data, /^[01]+$/);
  assert.notEqual(first.encodings[0].data, second.encodings[0].data);
});
