import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('local worktree checkouts stay outside repository-wide tooling', () => {
  assert.match(read('../../.gitignore'), /^\.worktrees\/$/m);
  assert.match(read('../../.prettierignore'), /^\.worktrees$/m);
  const workspace = JSON.parse(read('../../package.json'));
  assert.equal(workspace.scripts.lint, 'pnpm --filter @showcrafter/web lint');
});

test('shows callers import focused owner modules without compatibility barrels', () => {
  assert.equal(existsSync(join(root, 'lib/shows.server.ts')), false);
  assert.equal(existsSync(join(root, 'lib/shows/index.ts')), false);
});
