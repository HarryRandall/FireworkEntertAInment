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

test('shared access and public template reads stay outside the admin domain', () => {
  assert.equal(existsSync(join(root, 'lib/admin/current-user.server.ts')), false);
  assert.equal(existsSync(join(root, 'lib/access/current-user.server.ts')), true);
  assert.equal(existsSync(join(root, 'lib/show-templates/queries.server.ts')), true);

  const adminTemplates = read('lib/admin/templates.server.ts');
  assert.doesNotMatch(adminTemplates, /export async function listShowTemplates/);
  assert.doesNotMatch(adminTemplates, /export async function getShowTemplateBySlug/);
});

test('firework import implementation has one shared domain owner', () => {
  for (const path of [
    'firework-import-trigger.server.ts',
    'import-jobs.ts',
    'import-reconstruction.ts',
    'import-render-auth-core.ts',
    'import-render-auth.server.ts',
    'import-render-metrics.ts',
    'import-review.server.ts',
    'import-review.ts',
    'import-video-preview.js',
    'reconstruction-shot.ts',
    'fireworks/import-renderer-contract.ts',
  ]) {
    assert.equal(existsSync(join(root, 'lib', path)), false, path);
  }

  for (const path of [
    'jobs.ts',
    'reconstruction.ts',
    'reconstruction-shot.ts',
    'render-auth-core.ts',
    'render-auth.server.ts',
    'render-metrics.ts',
    'renderer-contract.ts',
    'review.server.ts',
    'review.ts',
    'trigger.server.ts',
    'video-preview.js',
  ]) {
    assert.equal(existsSync(join(root, 'lib/firework-import', path)), true, path);
  }
});
