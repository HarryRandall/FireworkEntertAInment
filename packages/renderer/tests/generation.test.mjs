/** Regression checks that the checked-in generated schema is current. */
import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('generation checks fail on stale output and regeneration repairs it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'showcrafter-schema-'));
  try {
    mkdirSync(join(directory, 'src/schema'), { recursive: true });
    for (const path of ['scripts', 'schema']) {
      cpSync(new URL(`../${path}`, import.meta.url), join(directory, path), { recursive: true });
    }
    const generated = join(directory, 'src/schema/design.generated.ts');
    cpSync(new URL('../src/schema/design.generated.ts', import.meta.url), generated);
    symlinkSync(
      fileURLToPath(new URL('../node_modules', import.meta.url)),
      join(directory, 'node_modules'),
    );
    const run = (...args) =>
      spawnSync(process.execPath, ['scripts/generate-schema.mjs', ...args], {
        cwd: directory,
        encoding: 'utf8',
      });
    const initial = readFileSync(generated, 'utf8');
    assert.equal(run('--check').status, 0);
    writeFileSync(generated, `${initial}\n// Stale output\n`);
    const stale = run('--check');
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /Generated design schema is stale/);
    assert.equal(run().status, 0);
    assert.equal(readFileSync(generated, 'utf8'), initial);
    assert.equal(run('--check').status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
