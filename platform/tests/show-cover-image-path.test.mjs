/** Static guards for the pre-rendered cover poster (cover_image_path) feature. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('cover_image_path column + covers bucket migration is well-formed', () => {
  const migrationPath = 'supabase/migrations/20260701113000_add_cover_image_path.sql';
  assert.equal(existsSync(join(root, migrationPath)), true);

  const migration = read(migrationPath);
  assert.match(migration, /ALTER TABLE shows ADD COLUMN IF NOT EXISTS cover_image_path text;/);
  assert.match(
    migration,
    /ALTER TABLE show_presets ADD COLUMN IF NOT EXISTS cover_image_path text;/,
  );
  // Public covers bucket, PNG only, 5 MB cap.
  assert.match(
    migration,
    /insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)/,
  );
  assert.match(migration, /values \('covers', 'covers', true, 5242880, array\['image\/png'\]\)/);
  // Public read for anon + authenticated.
  assert.match(migration, /create policy "covers_select_anyone" on storage\.objects/);
  assert.match(migration, /for select\s+to anon, authenticated\s+using \(bucket_id = 'covers'\)/);
  // Owner-scoped writes keyed by the first path segment matching auth.uid().
  assert.match(migration, /create policy "covers_insert_own" on storage\.objects/);
  assert.match(migration, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
  assert.match(migration, /create policy "covers_update_own" on storage\.objects/);
  assert.match(migration, /create policy "covers_delete_own" on storage\.objects/);
});

test('generated types expose cover_image_path on shows and show_presets', () => {
  const types = read('lib/database.types.ts');
  const showsTypes = types.match(/shows: \{[\s\S]*?show_timeline_items:/)?.[0] ?? '';
  const showPresetsTypes = types.match(/show_presets: \{[\s\S]*?show_timeline_items:/)?.[0] ?? '';

  assert.match(showsTypes, /cover_image_path: string \| null/);
  assert.match(showsTypes, /cover_image_path\?: string \| null/);
  assert.match(showPresetsTypes, /cover_image_path: string \| null/);
  assert.match(showPresetsTypes, /cover_image_path\?: string \| null/);
});

test('cover image path flows through domain types, mappers, and select lists', () => {
  const adminTypes = read('lib/admin.types.ts');
  const domain = read('lib/show-domain.ts');
  const summary = read('lib/show-summary.ts');
  const adminMapper = read('lib/admin/mappers.ts');
  const showMapper = read('lib/shows/mappers.ts');
  const showTypes = read('lib/shows/types.ts');
  const templates = read('lib/admin/templates.server.ts');
  const seedTemplates = read('lib/library-seed-templates.ts');
  const cloneAction = read('app/actions/show-templates.ts');

  assert.match(adminTypes, /coverImagePath: string \| null/);
  assert.match(domain, /coverImagePath: string \| null/);
  assert.match(summary, /coverImagePath: string \| null/);
  assert.match(summary, /coverImagePath: show\.coverImagePath,/);
  assert.match(adminMapper, /coverImagePath: row\.cover_image_path \?\? null,/);
  assert.match(showMapper, /coverImagePath: row\.cover_image_path \?\? null,/);
  assert.match(showTypes, /\| 'cover_image_path'/);
  assert.match(showTypes, /cover_shader, updated_at, cover_image_path'/);
  assert.match(
    templates,
    /SHOW_TEMPLATES_SELECT = `\$\{SHOW_TEMPLATES_BASE_SELECT\}, cover_shader, cover_image_path`/,
  );
  // Seeded (no DB row) templates default to no poster.
  assert.match(seedTemplates, /coverShader: shaderCoverFromSeed\(slug\),\s+coverImagePath: null,/);
  // Cloning a template copies its poster path onto the new show.
  assert.match(
    cloneAction,
    /cover_shader: template\.coverShader \?\? randomCover\(\),\s+cover_image_path: template\.coverImagePath \?\? null,/,
  );
});

test('cover poster render util and component exist with a neutral skeleton fallback', () => {
  const renderUtil = read('lib/render-cover-poster.tsx');
  const poster = read('app/components/app/CoverPoster.tsx');
  const urlHelper = read('lib/cover-poster-url.ts');

  assert.match(renderUtil, /export async function renderCoverToPng/);
  assert.match(renderUtil, /canvas\.toDataURL\('image\/png'\)/);
  // CSS covers snapshot the frozen DOM so the poster equals the live still.
  assert.match(renderUtil, /renderCssCoverPoster/);
  assert.match(renderUtil, /animate=\{false\}/);
  assert.match(renderUtil, /root\.unmount\(\)/);
  assert.match(poster, /export function CoverPoster/);
  assert.match(poster, /import \{ Skeleton \}/);
  assert.match(poster, /<Skeleton className="absolute inset-0 h-full w-full rounded-none" \/>/);
  assert.doesNotMatch(poster, /coverGradient/);
  assert.match(poster, /coverPosterUrl\(imagePath\)/);
  assert.match(poster, /<img/);
  assert.match(urlHelper, /storage\/v1\/object\/public\/covers\//);
});

test('user-show capture uploads and persists via a server action', () => {
  const action = read('app/actions/show-cover-poster.ts');
  const animation = read('app/components/app/GeneratingShowAnimation.tsx');
  const generatingPage = read('app/(app)/shows/[id]/generating/page.tsx');

  assert.match(action, /export async function setShowCoverImagePath/);
  assert.match(action, /update\(\{ cover_image_path: path \}\)/);
  assert.match(animation, /renderCoverToPng\(activeCover\)/);
  assert.match(animation, /from\('covers'\)\s*\.upload\(path, blob/);
  assert.match(animation, /setShowCoverImagePath\(showId, path\)/);
  assert.match(generatingPage, /showId=\{show\.id\}/);
  assert.match(generatingPage, /coverImagePath=\{show\.coverImagePath\}/);
});

test('admin backfill page + service-role action write preset posters', () => {
  const page = read('app/(admin)/admin/cover-posters/page.tsx');
  const backfill = read('app/(admin)/admin/cover-posters/CoverPosterBackfill.tsx');
  const action = read('app/actions/admin-cover-posters.ts');
  const list = read('lib/admin/cover-posters.server.ts');

  assert.match(page, /listShowPresetsForCoverBackfill/);
  assert.match(backfill, /renderCoverToPng\(preset\.cover\)/);
  assert.match(backfill, /backfillPresetCoverPoster\(preset\.id, dataUrl\)/);
  assert.match(action, /requirePermission\('admin\.manage_catalogue'\)/);
  assert.match(action, /createServiceRoleSupabase\(\)/);
  assert.match(action, /upload\(path, buffer,/);
  assert.match(action, /contentType: 'image\/png'/);
  assert.match(action, /cacheControl: 'public, max-age=31536000, immutable'/);
  assert.match(action, /upsert: true/);
  assert.match(action, /update\(\{ cover_image_path: path \}\)/);
  assert.match(list, /requirePermission\('admin\.manage_catalogue'\)/);
});
