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
  const migration = read('supabase/migrations/20260710011816_add_show_preset_likes.sql');
  const action = read('app/actions/show-preset-likes.ts');
  const button = read('app/components/app/TemplateLikeButton.tsx');
  const mapper = read('lib/admin/mappers.ts');
  const card = read('app/components/app/ExploreCard.tsx');

  assert.match(migration, /create table if not exists public\.show_preset_likes/);
  assert.match(migration, /primary key \(show_preset_id, user_id\)/);
  assert.match(migration, /create table if not exists public\.show_preset_like_counts/);
  assert.match(migration, /show_preset_likes_select_own/);
  assert.match(migration, /show_preset_like_counts_read_anyone/);
  assert.match(migration, /create or replace function public\.toggle_show_preset_like/);
  assert.match(migration, /revoke execute[\s\S]*from public, anon/);
  assert.match(migration, /grant execute[\s\S]*to authenticated, service_role/);

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
  const migration = read(
    'supabase/migrations/20260710011537_add_show_preset_source_provenance.sql',
  );
  const actions = read('app/actions/admin-show-presets.ts');
  const templates = read('lib/admin/templates.server.ts');
  const types = read('lib/admin.types.ts');
  const adminPage = read('app/(admin)/admin/show-presets/page.tsx');

  assert.match(migration, /source_show_id uuid/);
  assert.match(migration, /references public\.shows\(id\) on delete set null/);
  assert.match(migration, /create unique index[\s\S]*show_presets_source_show_id_key/);
  assert.match(actions, /source_show_id: show\.id/);
  assert.match(actions, /\.eq\('source_show_id', show\.id\)/);
  assert.match(templates, /importedShowIds/);
  assert.match(templates, /PUBLIC_SHOW_TEMPLATES_SELECT/);
  assert.match(templates, /PUBLIC_SHOW_TEMPLATES_FALLBACK_SELECTS/);
  const publicTemplateType = types.match(/export type ShowTemplate = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.doesNotMatch(publicTemplateType, /sourceShowId/);
  assert.match(adminPage, /preset\.sourceShowId \? 'Imported' : 'Curated'/);
});

test('published Explore seed timelines are scheduled across safe launch positions', () => {
  const migration = read(
    'supabase/migrations/20260710012517_schedule_published_show_preset_cues.sql',
  );

  assert.match(migration, /where is_published/);
  assert.match(migration, /busy_until := array\[0::numeric, 0::numeric, 0::numeric\]/);
  assert.match(migration, /greatest\(original_time, busy_until\[scheduled_lane \+ 1\]\)/);
  assert.match(
    migration,
    /latest_end := greatest\(latest_end, scheduled_time \+ product_duration\)/,
  );
  assert.match(migration, /ceil\(latest_end\)::integer/);
  assert.match(migration, /'emphasis', coalesce\(cue_row\.cue->>'emphasis', 'normal'\)/);
  assert.match(migration, /create temporary table safe_catalogue_item_durations/);
  assert.match(
    migration,
    /shot\.time_offset_seconds[\s\S]*?max\(child_item\.duration_seconds\)[\s\S]*?coalesce\(child_firework\.duration_seconds[\s\S]*?0\.5::numeric/,
  );
  assert.match(
    migration,
    /timeSeconds'\)::numeric[\s\S]*?item\.duration_seconds[\s\S]*?> repaired\.duration_seconds/,
  );
  assert.match(migration, /launch-position overlap/);
  assert.match(migration, /disable trigger show_templates_set_updated_at/);
  assert.match(migration, /enable trigger show_templates_set_updated_at/);
  assert.match(migration, /preset\.updated_at is distinct from repaired\.original_updated_at/);
});
