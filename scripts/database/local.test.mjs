import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t, status = {}) {
  const root = mkdtempSync(join(tmpdir(), 'showcrafter-local-db-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts/database'), { recursive: true });
  mkdirSync(join(root, 'apps/web'), { recursive: true });
  mkdirSync(join(root, 'bin'));
  copyFileSync(new URL('./local.mjs', import.meta.url), join(root, 'scripts/database/local.mjs'));
  writeFileSync(
    join(root, 'bin/pnpm'),
    `#!${process.execPath}\n` +
      `require('node:fs').writeFileSync(${JSON.stringify(join(root, 'arguments.json'))}, JSON.stringify(process.argv.slice(2)));\n` +
      `console.log(${JSON.stringify(JSON.stringify(status))});\n`,
    { mode: 0o755 },
  );
  return {
    root,
    envPath: join(root, 'apps/web/.env.local'),
    run: (...args) =>
      spawnSync(process.execPath, [join(root, 'scripts/database/local.mjs'), ...args], {
        env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
        encoding: 'utf8',
      }),
  };
}

test('reset explicitly selects the local database and rejects additional destination flags', (t) => {
  const f = fixture(t);
  assert.equal(f.run('reset').status, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(f.root, 'arguments.json'), 'utf8')), [
    'exec',
    'supabase',
    'db',
    'reset',
    '--local',
  ]);
  assert.equal(f.run('reset', '--linked').status, 1);
});

test('environment creation refuses hosted or other local project credentials', (t) => {
  for (const API_URL of ['https://example.supabase.co', 'http://127.0.0.1:54321']) {
    const f = fixture(t, { API_URL, ANON_KEY: 'public-key', SERVICE_ROLE_KEY: 'private-key' });
    const result = f.run('env');
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /private-key/);
    assert.throws(() => readFileSync(f.envPath), { code: 'ENOENT' });
  }
});

test('local credentials are written once and optional inherited services are disabled', (t) => {
  const f = fixture(t, {
    API_URL: 'http://127.0.0.1:55421',
    ANON_KEY: 'public-key',
    SERVICE_ROLE_KEY: 'private-key',
  });
  const first = f.run('env');
  assert.equal(first.status, 0, first.stderr);
  const original = readFileSync(f.envPath, 'utf8');
  assert.match(original, /SUPABASE_SERVICE_ROLE_KEY=private-key/);
  assert.match(original, /^ANALYSER_URL=$/m);
  assert.match(original, /^OPENROUTER_API_KEY=$/m);
  assert.match(original, /^UPSTASH_REDIS_REST_URL=$/m);
  assert.doesNotMatch(first.stdout + first.stderr, /private-key/);
  assert.equal(f.run('env').status, 1);
  assert.equal(readFileSync(f.envPath, 'utf8'), original);
});
