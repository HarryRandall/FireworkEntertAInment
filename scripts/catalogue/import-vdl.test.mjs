import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildImport, importMigration, readProducts } from './import-vdl.mjs';

const header = 'part_number,name,kind,caliber,duration_seconds,vdl,manufacturer,finale_product_id';
const cake =
  'SC-T1,Test Cake,cake,30mm,4,"6 Shot (a) Red Peony + (b) Gold Brocade Cake, 2 Rows, Row 1 (aba), Row 2 (2.0/bab/STT)",ShowCrafter Originals,';
const shell =
  'SC-T2,Test Shell,shell,"3""",,Big Gold Kamuro w/ Red Pistil w/ Gold Tail Shell,ShowCrafter Originals,';

test('a cake row builds its fireworks and spreads untimed rows over its duration', () => {
  const [product] = buildImport(readProducts(`${header}\n${cake}\n`));
  assert.equal(product.shots.length, 6);
  // Free gaps fill the 4 s the 2 s delay leaves: 0, 1, 2, then the together row at 4.
  assert.deepEqual(
    [...new Set(product.shots.map((shot) => shot.time_offset_seconds))],
    [0, 1, 2, 4],
  );
  assert.ok(product.fireworks.every((firework) => firework.caliber === '30mm'));
});

test('a single row builds one firework of its declared family', () => {
  const [product] = buildImport(readProducts(`${header}\n${shell}\n`));
  assert.equal(product.firework.design.kind, 'shell');
  // 3 inches is 76.2 mm, so Finale's default height is 76.2 m.
  assert.equal(product.firework.height_meters, 76.2);
});

test('unknown VDL words, wrong families and duplicate parts are refused', () => {
  assert.throws(
    () => buildImport(readProducts(`${header}\nSC-X,Bad,shell,30mm,,Purple Wibble Shell,M,\n`)),
    /unknown words Wibble/,
  );
  assert.throws(
    () => buildImport(readProducts(`${header}\nSC-X,Bad,comet,30mm,,Red Peony,M,\n`)),
    /describes a shell, not a comet/,
  );
  assert.throws(() => readProducts(`${header}\n${shell}\n${shell}\n`), /duplicate part number/);
});

test('the migration creates, then describes and lists each product', () => {
  const products = buildImport(readProducts(`${header}\n${cake}\n${shell}\n`));
  const sql = importMigration(products, 'test.csv');
  assert.match(sql, /perform pg_temp\.import_cake\('SC-T1'/);
  assert.match(sql, /perform pg_temp\.import_single\('SC-T2'/);
  assert.match(
    sql,
    /perform pg_temp\.describe_product\('SC-T1', 'Test Cake', .*'Cake', 4, 'ShowCrafter Originals', null\)/,
  );
  assert.match(sql, /is_listed = true/);
  // Empty databases skip the import instead of failing on missing renderer templates.
  assert.match(
    sql,
    /if not exists \(select 1 from public\.firework_effects where template_key is not null\)/,
  );
});

test('the checked-in ShowCrafter originals all build cleanly', () => {
  const csv = readFileSync(
    new URL('./originals/showcrafter-originals.csv', import.meta.url),
    'utf8',
  );
  const products = buildImport(readProducts(csv));
  assert.equal(products.filter((product) => product.kind === 'cake').length, 100);
  assert.ok(products.every((product) => product.manufacturer === 'ShowCrafter Originals'));
  assert.ok(products.every((product) => !product.finaleProductId));
});
