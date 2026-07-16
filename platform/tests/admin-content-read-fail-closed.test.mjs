/** Focused source guards for authorised admin content reads. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('catalogue and supplier reads preserve denial contracts but throw after authorised failures', () => {
  const catalogue = read('lib/admin/catalogue.server.ts');
  const suppliers = read('lib/admin/suppliers.server.ts');

  assert.match(
    catalogue,
    /if \(!\(await requirePermission\('admin\.manage_catalogue'\)\)\) return \[\];/,
  );
  assert.match(
    catalogue,
    /if \(error\) \{\s*throwCatalogueReadError\('listCatalogueProducts', error\);\s*\}/,
  );
  assert.match(catalogue, /throw new Error\('Catalogue products could not be loaded\.'/);
  assert.doesNotMatch(catalogue, /listCatalogueProducts failed:[\s\S]*?return \[\]/);

  assert.match(
    suppliers,
    /if \([\s\S]*?requirePermission\('admin\.manage_suppliers'\)[\s\S]*?requirePermission\('supplier\.view'\)[\s\S]*?\) \{\s*return \[\];\s*\}/,
  );
  assert.match(
    suppliers,
    /if \(error\) \{\s*throwSupplierReadError\('listSuppliers', error\);\s*\}/,
  );
  assert.match(suppliers, /throw new Error\('Suppliers could not be loaded\.'/);
  assert.doesNotMatch(suppliers, /listSuppliers failed:[\s\S]*?return \[\]/);
});

test('import list errors cannot reach mapping, fabricated legacy values, or the cache', () => {
  const source = read('lib/admin/imports.server.ts');
  const errorCheck = source.indexOf("throwImportReadError('listImportJobs', error)");
  const mapping = source.indexOf(
    'const mapped = ((data ?? []) as ImportJobRow[]).map(mapImportJob)',
  );
  const cacheWrite = source.indexOf('await setCachedJson(cacheKey, mapped');

  assert.match(
    source,
    /if \(!\(await requirePermission\('admin\.manage_imports'\)\)\) return \[\];/,
  );
  assert.ok(errorCheck >= 0, 'list errors are rejected');
  assert.ok(mapping > errorCheck, 'mapping runs only after the error check');
  assert.ok(cacheWrite > mapping, 'only successful reads reach the cache');
  assert.doesNotMatch(source, /fallbackData|fallbackMapped|processingProgress: row\.status/);
});

test('import detail rejects job, media, output, and signed URL failures', () => {
  const source = read('lib/admin/imports.server.ts');

  assert.match(
    source,
    /if \(!\(await requirePermission\('admin\.manage_imports'\)\)\) return null;/,
  );
  assert.match(source, /throwImportReadError\('getImportJobDetail', jobError\)/);
  assert.match(
    source,
    /throwImportReadError\('getImportJobDetail media lookup', mediaResult\.error\)/,
  );
  assert.match(
    source,
    /throwImportReadError\('getImportJobDetail outputs lookup', outputsResult\.error\)/,
  );
  assert.match(source, /throwImportReadError\(\s*'createSignedImportVideoUrl'/);
  assert.doesNotMatch(source, /session import video signing failed:[\s\S]*?return null/);
  assert.match(source, /throw new Error\('Import data could not be loaded\.'/);
});
