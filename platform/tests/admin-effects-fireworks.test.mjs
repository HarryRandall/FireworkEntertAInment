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
  assert.match(fireworksServer, /requirePermission\('admin\.manage_catalogue'\)/);
  assert.match(fireworksServer, /setCachedJson\(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS\)/);
  assert.match(index, /listAdminEffects/);
  assert.match(index, /listAdminFireworks/);
});

test('effect edits validate JSON, preserve legacy shapes, and use conflict detection', () => {
  const actions = read('app/actions/admin-effects.ts');
  const updateBody = functionBody(actions, 'updateEffect');

  assert.match(actions, /Effect JSON must be an object/);
  assert.match(updateBody, /\.eq\('updated_at', parsed\.data\.expectedUpdatedAt\)/);
  assert.match(updateBody, /spec_json: spec\.value/);
  assert.match(updateBody, /invalidateAdminEffectsCache\(parsed\.data\.id\)/);
  assert.match(updateBody, /invalidateAdminFireworksCache\(\)/);
  assert.match(updateBody, /invalidateFireworkCatalogueCaches\(\)/);
  assert.doesNotMatch(
    updateBody,
    /FireworkSpecSchema|safeParseFireworkSpec|safeParseFireworkDesign/,
  );
});

test('AI effect refinement uses the cheap configurable model and returns a draft only', () => {
  const actions = read('app/actions/admin-effects.ts');
  const refineBody = functionBody(actions, 'refineEffectDraft');

  assert.match(actions, /OPENROUTER_EFFECT_MODEL \?\? 'openai\/gpt-4\.1-mini'/);
  assert.match(refineBody, /getOpenRouterClient/);
  assert.match(refineBody, /response_format: \{ type: 'json_object' \}/);
  assert.match(refineBody, /return \{\s*ok: true,[\s\S]*draft:/);
  assert.doesNotMatch(refineBody, /\.from\('effect_specs'\)/);
  assert.doesNotMatch(refineBody, /\.update\(/);
});

test('catalogue and import mutations invalidate new admin firework caches', () => {
  const catalogue = read('app/actions/admin-catalogue.ts');
  const imports = read('app/actions/platform-admin.ts');

  assert.match(catalogue, /invalidateAdminEffectsCache/);
  assert.match(catalogue, /invalidateAdminFireworksCache/);
  assert.match(imports, /invalidateAdminEffectsCache\(effect\.id\)/);
  assert.match(imports, /invalidateAdminFireworksCache\(\)/);
});
