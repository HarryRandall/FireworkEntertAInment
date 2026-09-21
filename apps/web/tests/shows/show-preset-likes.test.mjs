/** Static guards for real Explore likes and import provenance. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('Explore likes persist without exposing user identities', () => {
  const action = read('lib/show-templates/like-actions.server.ts');
  const button = read('ui/explore/TemplateLikeButton.tsx');
  const mapper = read('lib/show-templates/mappers.ts');
  const card = read('ui/explore/ExploreCard.tsx');

  assert.match(action, /toggle_show_preset_like/);
  assert.match(action, /invalidateShowTemplatesCache/);
  assert.match(button, /aria-pressed=\{liked\}/);
  assert.doesNotMatch(button, /localStorage/);
  assert.doesNotMatch(mapper, /deriveTemplateLikeCount/);
  assert.match(mapper, /showPresetLikeCount/);
  assert.doesNotMatch(card, /Deterministic engagement numbers/);
  assert.doesNotMatch(card, /comments|9000|130000/);
});

test('imported Explore presets retain durable generated-show provenance', () => {
  const actions = read('app/(admin)/admin/show-presets/actions.ts');
  const templates = read('lib/show-templates/queries.server.ts');
  const adminTemplates = read('app/(admin)/admin/show-presets/queries.server.ts');
  const types = read('lib/show-templates/types.ts');
  const adminPage = read('app/(admin)/admin/show-presets/page.tsx');
  assert.match(actions, /source_show_id: show\.id/);
  assert.match(actions, /\.eq\('source_show_id', show\.id\)/);
  assert.match(adminTemplates, /importedShowIds/);
  assert.match(templates, /PUBLIC_SHOW_TEMPLATES_SELECT/);
  assert.match(templates, /PUBLIC_SHOW_TEMPLATES_FALLBACK_SELECTS/);
  const publicTemplateType = types.match(/export type ShowTemplate = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.doesNotMatch(publicTemplateType, /sourceShowId/);
  assert.match(adminPage, /preset\.sourceShowId \? 'Imported' : 'Curated'/);
});
