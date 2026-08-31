import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const actions = readFileSync(join(process.cwd(), 'app/actions/admin-suppliers.ts'), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const brace = source.indexOf('{', start);
  let depth = 0;

  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(brace + 1, index);
  }

  throw new Error(`${name} body was not closed`);
}

test('supplier updates fail when no row was modified', () => {
  const body = functionBody(actions, 'updateSupplier');

  assert.match(
    body,
    /\.update\([\s\S]*?\.eq\('id', parsed\.data\.id\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/,
  );
  assert.match(
    body,
    /if \(!updatedSupplier\) return \{ ok: false, error: 'Supplier not found\.' \};/,
  );
  assert.ok(
    body.indexOf('if (!updatedSupplier)') < body.indexOf('invalidateAdminSuppliersCache()'),
  );
});

test('supplier deletes fail when no row was removed', () => {
  const body = functionBody(actions, 'deleteSupplier');

  assert.match(
    body,
    /\.delete\(\)\s*\.eq\('id', parsed\.data\.id\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/,
  );
  assert.match(
    body,
    /if \(!deletedSupplier\) return \{ ok: false, error: 'Supplier not found\.' \};/,
  );
  assert.ok(
    body.indexOf('if (!deletedSupplier)') < body.indexOf('invalidateAdminSuppliersCache()'),
  );
});
