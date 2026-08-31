/** Static-analysis "grep the source" test guarding the recommendations / library schema invariants (do not modify test bodies). */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('show library routes and clone action exist', () => {
  assert.equal(existsSync(join(root, 'app/(browse)/library/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(browse)/library/[id]/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(browse)/library/loading.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(app)/recommendations/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(app)/recommendations/[id]/page.tsx')), true);
  const legacyPage = readFileSync(join(root, 'app/(app)/recommendations/page.tsx'), 'utf8');
  const legacyDetail = readFileSync(join(root, 'app/(app)/recommendations/[id]/page.tsx'), 'utf8');
  assert.match(legacyPage, /redirect\(['"]\/library['"]\)/);
  assert.match(legacyDetail, /redirect\(`\/library\/\$\{id\}`\)/);
  const action = readFileSync(join(root, 'app/actions/show-templates.ts'), 'utf8');
  assert.match(action, /cloneShowTemplateAction/);
  assert.match(action, /show_timeline_items/);
});

test('template migration seeds featured show templates', () => {
  const migration = readFileSync(
    join(root, 'supabase/migrations/0005_show_templates_and_access_rpc.sql'),
    'utf8',
  );
  const renameMigration = readFileSync(
    join(root, 'supabase/migrations/20260614132007_schema_firework_catalogue_rework.sql'),
    'utf8',
  );
  assert.match(migration, /create table if not exists public\.show_templates/);
  assert.match(migration, /golden-finale/);
  assert.match(migration, /patriotic-skyline/);
  assert.match(migration, /midnight-minimal/);
  assert.match(migration, /current_user_access/);
  assert.match(
    renameMigration,
    /alter table if exists public\.show_templates rename to show_presets/,
  );
  assert.doesNotMatch(renameMigration, /create view public\.show_templates/);
  assert.match(renameMigration, /drop view if exists public\.show_templates/);
});

test('show library templates use semi-static caching', () => {
  const cacheKeys = readFileSync(join(root, 'lib/admin/cache-keys.ts'), 'utf8');
  const templates = readFileSync(join(root, 'lib/admin/templates.server.ts'), 'utf8');
  assert.match(cacheKeys, /SHOW_TEMPLATES_TTL_SECONDS/);
  assert.match(cacheKeys, /getShowTemplatesCacheKey/);
  assert.match(cacheKeys, /show-templates:database-v4/);
  assert.match(templates, /getCachedJson<ShowTemplateSummary\[]>/);
  assert.match(templates, /const cacheKey = getShowTemplatesCacheKey\(\)/);
  assert.match(templates, /setCachedJson\(cacheKey, mapped/);
});

test('main navigation includes show library', () => {
  const shell = readFileSync(join(root, 'app/components/app/AppShell.tsx'), 'utf8');
  assert.match(shell, /href: '\/library', label: 'Explore'/);
  assert.doesNotMatch(shell, /label: 'Library'/);
  assert.doesNotMatch(shell, /Recommendations/);
});
