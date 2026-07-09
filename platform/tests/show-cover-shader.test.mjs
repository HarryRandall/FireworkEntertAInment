/** Static guards for per-show covers (CSS engine + legacy WebGL) on the generating splash. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('shows persist a JSON shader cover', () => {
  const migrationPath = 'supabase/migrations/20260629130000_add_cover_shader_to_shows.sql';
  assert.equal(existsSync(join(root, migrationPath)), true);

  const migration = read(migrationPath);
  const types = read('lib/database.types.ts');

  assert.match(migration, /ALTER TABLE shows ADD COLUMN IF NOT EXISTS cover_shader jsonb;/);
  assert.match(migration, /UPDATE shows\s+SET cover_shader = pg_temp\.random_shader_cover\(\)/);
  assert.match(types, /cover_shader: Json \| null/);
  assert.match(types, /cover_shader\?: Json \| null/);
});

test('library presets persist and expose JSON shader covers', () => {
  const migration = read('supabase/migrations/20260629130000_add_cover_shader_to_shows.sql');
  const types = read('lib/database.types.ts');
  const adminTypes = read('lib/admin.types.ts');
  const templates = read('lib/admin/templates.server.ts');
  const mapper = read('lib/admin/mappers.ts');
  const exploreCard = read('app/components/app/ExploreCard.tsx');
  const explorePreview = read('app/components/app/ExplorePreviewContext.tsx');
  const exploreRow = read('app/components/app/ExploreRow.tsx');
  const libraryPage = read('app/(app)/library/page.tsx');
  const cloneAction = read('app/actions/show-templates.ts');
  const showPresetsTypes = types.match(/show_presets: \{[\s\S]*?show_timeline_items:/)?.[0] ?? '';

  assert.match(migration, /ALTER TABLE show_presets ADD COLUMN IF NOT EXISTS cover_shader jsonb;/);
  assert.match(
    migration,
    /UPDATE show_presets\s+SET cover_shader = pg_temp\.random_shader_cover\(\)/,
  );
  assert.doesNotMatch(migration, /16777215/);
  assert.match(migration, /ARRAY\['#00e5ff', '#3b82f6', '#8b5cf6', '#ff3df2'\]/);
  assert.match(showPresetsTypes, /cover_shader: Json \| null/);
  assert.match(showPresetsTypes, /cover_shader\?: Json \| null/);
  assert.match(adminTypes, /coverShader: ShowCover \| null/);
  assert.match(adminTypes, /coverImagePath: string \| null/);
  assert.match(
    templates,
    /SHOW_TEMPLATES_SELECT =\s+`\$\{SHOW_TEMPLATES_BASE_SELECT\}, cover_shader, cover_image_path`/,
  );
  assert.match(mapper, /coverShader: parseCover\(row\.cover_shader\)/);
  assert.match(mapper, /coverImagePath: row\.cover_image_path \?\? null/);
  assert.match(exploreCard, /template\.coverShader \?\? shaderCoverFromSeed/);
  assert.match(exploreCard, /import \{ CoverPoster \}/);
  assert.match(exploreCard, /<CoverPoster\s+cover=\{cover\}/);
  assert.match(exploreCard, /imagePath=\{template\.coverImagePath\}/);
  assert.match(exploreCard, /group-hover:scale-105/);
  assert.match(exploreCard, /hover:-translate-y-2/);
  assert.match(exploreCard, /hover:translate-x-1/);
  assert.match(exploreCard, /hover:z-20/);
  assert.match(exploreCard, /motion-reduce:hover:translate-y-0/);
  assert.match(exploreCard, /const previewId = useId\(\)/);
  assert.match(exploreCard, /preview\?\.readyId === previewId/);
  assert.match(exploreCard, /requestPreview\(previewId, coverRef\.current, template\)/);
  assert.doesNotMatch(exploreCard, /requestPreview\(template\.id/);
  assert.match(explorePreview, /window\.addEventListener\('wheel', cancelActivePreview/);
  assert.match(explorePreview, /window\.addEventListener\('scroll', cancelActivePreview/);
  assert.match(explorePreview, /window\.addEventListener\('touchmove', cancelActivePreview/);
  assert.match(exploreRow, /data-explore-scroll-viewport/);
  assert.match(explorePreview, /closest\(\s*'\[data-explore-scroll-viewport\]'/);
  assert.match(explorePreview, /fadeWidth = 48/);
  assert.match(explorePreview, /overlay\.style\.clipPath = `inset/);
  assert.match(libraryPage, /ExplorePreviewProvider specifications=\{specifications\}/);
  assert.match(cloneAction, /cover_shader: template\.coverShader \?\? randomCover\(\)/);
});

test('show reads map cover_shader into the domain model', () => {
  const showTypes = read('lib/shows/types.ts');
  const mapper = read('lib/shows/mappers.ts');
  const domain = read('lib/show-domain.ts');

  assert.match(showTypes, /\| 'cover_shader'/);
  assert.match(showTypes, /launch_positions_json, cover_shader, updated_at/);
  assert.match(mapper, /coverShader: parseCover\(row\.cover_shader\)/);
  assert.match(domain, /coverShader: ShowCover \| null/);
});

test('new shows receive a CSS cover and render it on the splash', () => {
  const action = read('app/(app)/shows/new/actions.ts');
  const generatingPage = read('app/(app)/shows/[id]/generating/page.tsx');
  const animation = read('app/components/app/GeneratingShowAnimation.tsx');

  assert.match(action, /import \{ randomCover \} from '@\/lib\/cover';/);
  assert.match(action, /cover_shader: randomCover\(\)/);
  assert.match(generatingPage, /randomiseCoverOnLoad/);
  assert.match(generatingPage, /coverShader=\{creating === '1' \? null : show\.coverShader\}/);
  assert.match(generatingPage, /randomiseCoverOnLoad=\{creating === '1' \|\| !show\.coverShader\}/);
  assert.match(animation, /randomCover/);
  assert.match(animation, /coverShader\?: ShowCover \| null/);
  assert.match(animation, /randomiseCoverOnLoad\?: boolean/);
  // The rendered cover is the active cover with its shader clock resumed so
  // splash remounts stay continuous.
  assert.match(animation, /const displayCover = useMemo/);
  assert.match(
    animation,
    /if \(!activeCover \|\| !coverElapsedMs \|\| !activeCover\.speed\) return activeCover;/,
  );
  assert.match(animation, /<Cover cover=\{displayCover\} \/>/);
  // CSS covers resume in real seconds; legacy WebGL frames advance with speed.
  assert.match(animation, /isCssCover\(activeCover\)/);
});

test('still covers keep the real shader visible without normal animation', () => {
  const shaderCover = read('app/components/app/ShaderCover.tsx');
  const shaderLib = read('lib/shader-cover.ts');

  assert.doesNotMatch(shaderCover, /if \(!animate\) \{\s+return poster;\s+\}/);
  assert.match(shaderCover, /speed: animate \? speed : 0\.001/);
  assert.match(shaderCover, /shaderCoverBackdropColor\(cover\)/);
  assert.match(shaderCover, /showSkeletonUntilReady/);
  assert.match(shaderCover, /MutationObserver/);
  assert.match(shaderCover, /querySelector\('canvas'\)/);
  assert.match(shaderCover, /data-cover-loading/);
  assert.doesNotMatch(shaderCover, /setIsReady/);
  assert.doesNotMatch(shaderCover, /useState\('#ffffff'\)/);
  assert.match(shaderLib, /function normaliseCoverColor/);
  assert.match(shaderLib, /shaderCoverBackdropColor/);
  assert.match(shaderLib, /cheap loading fallback/);
});

test('Midnight Pulse has a visible palette-led cover', () => {
  const migration = read('supabase/migrations/20260629163000_fix_midnight_pulse_cover_shader.sql');

  assert.match(migration, /WHERE slug = 'midnight-pulse'/);
  assert.match(migration, /'#00e5ff'/);
  assert.match(migration, /'#8b5cf6'/);
  assert.doesNotMatch(migration, /'#(?:000000|05070d|050507|0a0a12|0b1020)'/);
});
