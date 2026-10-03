// Exercise schema embedding and drift detection in a disposable repository.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'showcrafter-documents-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of [
    'scripts/database',
    'supabase/schemas',
    'supabase/migrations',
    'supabase/documents',
    'packages/fireworks/schema',
  ]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  copyFileSync(
    new URL('documents.mjs', import.meta.url),
    join(root, 'scripts/database/documents.mjs'),
  );
  for (const file of [
    '00_extensions.sql',
    '01_private_helpers.sql',
    '10_markets.sql',
    '20_people.sql',
    '32_imports.sql',
    '40_range.sql',
    '60_shoppers.sql',
    '70_music.sql',
  ]) {
    writeFileSync(join(root, 'supabase/schemas', file), '-- fixture domain\n');
  }
  for (const [name, file] of [
    ['DESIGN', '30_fireworks.sql'],
    ['COMPOSITION', '31_catalogue.sql'],
    ['CUES', '50_shows_qr.sql'],
  ]) {
    writeFileSync(
      join(root, 'supabase/schemas', file),
      `-- preserved prefix\n-- BEGIN GENERATED ${name} SCHEMA\n-- END GENERATED ${name} SCHEMA\n-- preserved suffix\n`,
    );
  }
  writeFileSync(join(root, 'supabase/migrations/20261003000000_foundations.sql'), '');
  writeFileSync(join(root, 'packages/fireworks/schema/design.v1.json'), '{"type":"object"}');
  writeFileSync(join(root, 'supabase/documents/composition.v1.json'), '{"type":"array"}');
  writeFileSync(join(root, 'supabase/documents/cues.v1.json'), '{"type":"array"}');
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [join(root, 'scripts/database/documents.mjs'), ...args], {
    encoding: 'utf8',
  });
}

test('embedding preserves handwritten SQL and check mode detects source and baseline drift without writing', (t) => {
  const root = fixture(t);
  assert.equal(run(root).status, 0);
  assert.equal(run(root, '--check').status, 0);
  const declaration = join(root, 'supabase/schemas/30_fireworks.sql');
  const original = readFileSync(declaration, 'utf8');
  assert.ok(original.startsWith('-- preserved prefix\n'));
  assert.ok(original.endsWith('-- preserved suffix\n'));
  writeFileSync(join(root, 'packages/fireworks/schema/design.v1.json'), '{"type":"string"}');
  assert.equal(run(root, '--check').status, 1);
  assert.equal(readFileSync(declaration, 'utf8'), original);
  assert.equal(run(root).status, 0);
  const baseline = join(root, 'supabase/migrations/20261003000000_foundations.sql');
  writeFileSync(baseline, 'changed');
  assert.equal(run(root, '--check').status, 1);
  assert.equal(readFileSync(baseline, 'utf8'), 'changed');
});

test('malformed schemas, missing markers and unexpected arguments fail visibly', (t) => {
  const root = fixture(t);
  assert.equal(run(root, '--linked').status, 1);
  writeFileSync(join(root, 'supabase/documents/composition.v1.json'), '{');
  assert.equal(run(root).status, 1);
  writeFileSync(join(root, 'supabase/documents/composition.v1.json'), '{}');
  writeFileSync(join(root, 'supabase/schemas/31_catalogue.sql'), '-- missing markers');
  assert.equal(run(root).status, 1);
});
