/** Guards for the effects gallery after retiring legacy style-default editing. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { parseAdminEffectsView } = await import('../../lib/admin-effects-navigation.ts');
const read = (path) => readFileSync(path, 'utf8');

test('old style-default URLs select the active base-effects gallery', () => {
  assert.equal(parseAdminEffectsView('star'), 'base');
  assert.equal(parseAdminEffectsView(undefined, 'defaults'), 'base');
  assert.equal(parseAdminEffectsView('base'), 'base');
  assert.equal(parseAdminEffectsView('unknown'), 'base');
});

test('the gallery and preview endpoint cannot reach legacy style-default editing', () => {
  const browser = read('app/(admin)/admin/effects/_components/EffectsBrowser.tsx');
  const route = read('app/api/admin/firework-previews/[kind]/[id]/route.ts');
  const preview = read('ui/catalogue/FireworkBrowsePreviewContext.tsx');
  assert.match(browser, /<FireworkBrowseCard/);
  assert.doesNotMatch(browser, /style-default|defaults\/|StyleDefaultCreateAction/);
  assert.doesNotMatch(route, /'style-default'/);
  assert.doesNotMatch(preview, /legacy-editor|legacyEditor|estimateFireworkDesignTiming/);
  assert.equal(existsSync('app/(admin)/admin/effects/defaults/[id]/page.tsx'), false);
  assert.equal(existsSync('app/(admin)/admin/effects/style-default-actions.ts'), false);
  assert.match(read('lib/database.types.ts'), /firework_style_defaults:/);
});
