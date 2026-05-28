/** Static-analysis guards for the admin effects/fireworks browser. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(brace + 1, i);
  }
  throw new Error(`${name} body was not closed`);
}

test('admin effects and fireworks routes are first-class admin pages', () => {
  for (const path of [
    'app/(admin)/admin/effects/page.tsx',
    'app/(admin)/admin/effects/loading.tsx',
    'app/(admin)/admin/effects/[id]/page.tsx',
    'app/(admin)/admin/effects/[id]/loading.tsx',
    'app/(admin)/admin/fireworks/page.tsx',
    'app/(admin)/admin/fireworks/loading.tsx',
  ]) {
    assert.equal(existsSync(join(root, path)), true, `${path} exists`);
  }

  const shell = read('app/components/admin/AdminShell.tsx');
  const overview = read('app/(admin)/admin/page.tsx');
  assert.match(shell, /\/admin\/effects/);
  assert.match(shell, /\/admin\/fireworks/);
  assert.match(overview, /listAdminEffects/);
  assert.match(overview, /listAdminFireworks/);
});

test('effects and fireworks helpers are catalogue-admin gated and cached', () => {
  const cacheKeys = read('lib/admin/cache-keys.ts');
  const effectsServer = read('lib/admin/effects.server.ts');
  const fireworksServer = read('lib/admin/fireworks.server.ts');
  const index = read('lib/admin/index.ts');

  assert.match(cacheKeys, /getAdminEffectsCacheKey/);
  assert.match(cacheKeys, /getAdminEffectCacheKey/);
  assert.match(cacheKeys, /getAdminFireworksCacheKey/);
  assert.match(cacheKeys, /invalidateAdminEffectsCache/);
  assert.match(cacheKeys, /invalidateAdminFireworksCache/);
  assert.match(effectsServer, /requirePermission\('admin\.manage_catalogue'\)/);
  assert.match(effectsServer, /setCachedJson\(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS\)/);
  assert.match(effectsServer, /\.from\('firework_effects'\)/);
  assert.match(effectsServer, /firework_variants\(id\)/);
  assert.doesNotMatch(effectsServer, /\.from\('effect_specs'\)/);
  assert.match(fireworksServer, /requirePermission\('admin\.manage_catalogue'\)/);
  assert.match(fireworksServer, /setCachedJson\(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS\)/);
  assert.match(index, /listAdminEffects/);
  assert.match(index, /listAdminFireworks/);
});

test('base effect edits validate model JSON and use conflict detection', () => {
  const actions = read('app/actions/admin-effects.ts');
  const updateBody = functionBody(actions, 'updateEffect');

  assert.match(actions, /Model JSON must be an object/);
  assert.match(updateBody, /\.from\('firework_effects'\)/);
  assert.match(updateBody, /\.eq\('updated_at', parsed\.data\.expectedUpdatedAt\)/);
  assert.match(updateBody, /model_json: model\.value/);
  assert.match(updateBody, /pattern_key: parsed\.data\.patternKey/);
  assert.match(updateBody, /invalidateAdminEffectsCache\(parsed\.data\.id\)/);
  assert.match(updateBody, /invalidateAdminFireworksCache\(\)/);
  assert.match(updateBody, /invalidateFireworkCatalogueCaches\(\)/);
  assert.doesNotMatch(updateBody, /effect_specs|spec_json|FireworkSpecSchema/);
});

test('admin effects UI is wired to base effect fields', () => {
  const page = read('app/(admin)/admin/effects/page.tsx');
  const editor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');

  assert.match(page, /effect\.family/);
  assert.match(page, /effect\.patternKey/);
  assert.match(page, /effect\.variantCount/);
  assert.doesNotMatch(page, /effect\.durationSeconds|effect\.heightMeters|effect\.productCount/);
  assert.match(editor, /modelJson/);
  assert.match(editor, /patternKey/);
  assert.match(editor, /FireworkReplayCanvas/);
  assert.match(editor, /compileFireworkDesign/);
  assert.match(editor, /renderDefaults/);
  assert.match(editor, /Streak size/);
  assert.match(editor, /Streak length/);
  assert.match(editor, /Streak life/);
  assert.match(editor, /PREVIEW_COLOR/);
  assert.doesNotMatch(editor, /refineEffectDraft|specJson|linkedProducts/);
});

test('base effects seed default variants for missing effect families', () => {
  const migration = read('supabase/migrations/20260528220500_seed_default_firework_variants.sql');
  const expansion = read(
    'supabase/migrations/20260528233000_renderer_effect_geometry_expansion.sql',
  );

  for (const slug of [
    'brocade',
    'willow',
    'palm',
    'ring',
    'crossette',
    'horsetail',
    'comet',
    'mine',
    'crackle',
  ]) {
    assert.match(migration, new RegExp(`'${slug}'`));
  }
  for (const slug of ['pistil', 'pearls', 'tail', 'silver-fish', 'waterfall', 'whirl']) {
    assert.match(expansion, new RegExp(`'${slug}'`));
  }
  assert.match(migration, /where not exists/);
  assert.match(expansion, /where not exists/);
  assert.match(migration, /public\.firework_variants/);
  assert.match(expansion, /public\.firework_variants/);
});

test('catalogue and import mutations invalidate new admin firework caches', () => {
  const catalogue = read('app/actions/admin-catalogue.ts');
  const imports = read('app/actions/platform-admin.ts');

  assert.match(catalogue, /invalidateAdminEffectsCache/);
  assert.match(catalogue, /invalidateAdminFireworksCache/);
  assert.match(imports, /invalidateAdminEffectsCache\(effect\.id\)/);
  assert.match(imports, /invalidateAdminFireworksCache\(product\.id\)/);
});
