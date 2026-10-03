// Exercise test assembly and runner boundaries without a database or Docker.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepareTestSuites } from './test-suite.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'showcrafter-suite-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of [
    'supabase/vendor/basejump',
    'supabase/tests',
    'scripts/database',
    'output',
    'bin',
  ]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  copyFileSync(
    new URL('../../supabase/vendor/basejump/supabase_test_helpers--0.0.6.sql', import.meta.url),
    join(root, 'supabase/vendor/basejump/supabase_test_helpers--0.0.6.sql'),
  );
  writeFileSync(join(root, 'supabase/tests/00_helpers.sql'), '-- fixture helpers');
  writeFileSync(
    join(root, 'supabase/tests/01_first.sql'),
    'select plan(0);\nselect * from finish();',
  );
  for (const name of ['test.mjs', 'test-suite.mjs'])
    copyFileSync(new URL(name, import.meta.url), join(root, 'scripts/database', name));
  return root;
}

test('each domain gets pinned helpers and its own rollback transaction', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'supabase/tests/02_second.sql'), '-- second suite');
  const paths = prepareTestSuites(root, join(root, 'output'));
  assert.deepEqual(readdirSync(join(root, 'output')), ['01_first.sql', '02_second.sql']);
  for (const path of paths) {
    const sql = readFileSync(path, 'utf8');
    assert.ok(sql.startsWith('\\set ON_ERROR_STOP on\nbegin;'));
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION tests.authenticate_as'));
    assert.ok(sql.includes('-- fixture helpers'));
    assert.ok(!sql.includes('\\quit'));
    assert.ok(sql.endsWith('reset role;\nrollback;\n'));
  }
});

test('unexpected vendor changes and an empty suite fail before execution', (t) => {
  const root = fixture(t);
  rmSync(join(root, 'supabase/tests/01_first.sql'));
  assert.throws(() => prepareTestSuites(root, join(root, 'output')), /No database suites/);
  writeFileSync(join(root, 'supabase/vendor/basejump/supabase_test_helpers--0.0.6.sql'), 'changed');
  assert.throws(
    () => prepareTestSuites(root, join(root, 'output')),
    /differs from the pinned source/,
  );
});

test('runner uses only local CLI flags, propagates failures and cleans temporary SQL', (t) => {
  const root = fixture(t);
  const capture = join(root, 'capture.json');
  writeFileSync(
    join(root, 'bin/pnpm'),
    `#!${process.execPath}\n` +
      `const fs = require('node:fs'); const args = process.argv.slice(2);\n` +
      `fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify({args, sql: fs.readFileSync(args.at(-1), 'utf8')}));\nprocess.exit(7);\n`,
    { mode: 0o755 },
  );
  const run = (...args) =>
    spawnSync(process.execPath, [join(root, 'scripts/database/test.mjs'), ...args], {
      env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
      encoding: 'utf8',
    });
  assert.equal(run('--linked').status, 1);
  assert.equal(run().status, 7);
  const result = JSON.parse(readFileSync(capture, 'utf8'));
  assert.deepEqual(result.args.slice(0, -1), ['exec', 'supabase', 'test', 'db', '--local']);
  assert.ok(result.sql.endsWith('rollback;\n'));
  assert.throws(() => readFileSync(result.args.at(-1)), { code: 'ENOENT' });
});

test('domain fixture definitions are included before assertions in every isolated suite', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'supabase/tests/fixtures'));
  const definition = 'create function tests.example() returns int language sql as $$ select 1; $$;';
  writeFileSync(join(root, 'supabase/tests/fixtures/example.sql'), definition);
  const [path] = prepareTestSuites(root, join(root, 'output'));
  const sql = readFileSync(path, 'utf8');
  assert.ok(sql.includes(definition));
  assert.ok(sql.indexOf(definition) < sql.indexOf('select plan(0)'));
  assert.ok(sql.endsWith('reset role;\nrollback;\n'));
});
