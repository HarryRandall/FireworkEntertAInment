/** Static and pure-module guards for persisted firework browse images. */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function previewMigration() {
  const matches = readdirSync(join(root, 'supabase/migrations')).filter((name) =>
    name.endsWith('_add_firework_preview_images.sql'),
  );
  assert.equal(matches.length, 1, 'expected exactly one firework preview image migration');
  return read(`supabase/migrations/${matches[0]}`);
}

function functionBody(source, functionName) {
  const pattern = new RegExp(
    `create or replace function private\\.${functionName}\\(\\)[\\s\\S]*?\\$\\$;`,
  );
  const match = source.match(pattern);
  assert.ok(match, `missing ${functionName}`);
  return match[0];
}

function loadPreviewImageModule() {
  const source = read('lib/firework-preview-image.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  Function('exports', 'module', output)(loadedModule.exports, loadedModule);
  return loadedModule.exports;
}

test('preview manifest has one source, public reads and server-only writes', () => {
  const migration = previewMigration();

  assert.match(migration, /create table public\.firework_preview_images/);
  assert.match(migration, /num_nonnulls\(firework_effect_id, firework_id, multishot_id\) = 1/);
  assert.match(migration, /firework_effect_id uuid unique references public\.firework_effects/);
  assert.match(migration, /firework_id uuid unique references public\.fireworks/);
  assert.match(migration, /multishot_id uuid unique references public\.multishots/);
  assert.match(migration, /alter table public\.firework_preview_images enable row level security/);
  assert.match(
    migration,
    /revoke all on table public\.firework_preview_images from anon, authenticated/,
  );
  assert.match(
    migration,
    /grant select on table public\.firework_preview_images to anon, authenticated/,
  );
  assert.match(migration, /grant all on table public\.firework_preview_images to service_role/);
  assert.match(
    migration,
    /create policy firework_preview_images_select_anyone[\s\S]*?for select[\s\S]*?to anon, authenticated[\s\S]*?using \(true\)/,
  );
  assert.doesNotMatch(migration, /create policy[^;]+for (?:insert|update|delete)/i);
});

test('preview manifest revisions invalidate effect, firework and multishot captures', () => {
  const migration = previewMigration();
  const effectBump = functionBody(migration, 'bump_effect_preview_images');
  const fireworkBump = functionBody(migration, 'bump_firework_preview_images');
  const multishotBump = functionBody(migration, 'bump_multishot_preview_image');

  for (const body of [effectBump, fireworkBump, multishotBump]) {
    assert.match(body, /source_revision = preview\.source_revision \+ 1/);
    assert.match(body, /renderer_version = null/);
    assert.match(body, /source_signature = null/);
    assert.match(body, /storage_path = null/);
    assert.match(body, /captured_at = null/);
  }

  assert.match(effectBump, /preview\.firework_effect_id = new\.id/);
  assert.match(effectBump, /where firework\.firework_effect_id = new\.id/);
  assert.match(effectBump, /join public\.fireworks firework on firework\.id = shot\.firework_id/);
  assert.match(
    migration,
    /create trigger firework_effects_bump_preview_images[\s\S]*?after update of model_json, pattern_key/,
  );

  assert.match(fireworkBump, /preview\.firework_id = new\.id/);
  assert.match(fireworkBump, /where shot\.firework_id = new\.id/);
  assert.match(
    migration,
    /create trigger fireworks_bump_preview_images[\s\S]*?after update of[\s\S]*?render_overrides_json/,
  );

  assert.match(multishotBump, /where preview\.multishot_id = new\.id/);
  assert.match(
    migration,
    /create trigger multishots_bump_preview_image[\s\S]*?after update on public\.multishots/,
  );

  for (const name of [
    'ensure_firework_preview_image',
    'bump_effect_preview_images',
    'bump_firework_preview_images',
    'bump_multishot_preview_image',
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke execute on function private\\.${name}\\(\\)[\\s\\S]*?from public, anon, authenticated, service_role`,
      ),
      name,
    );
  }
});

test('preview images use a public WebP-only bucket without browser write policy', () => {
  const migration = previewMigration();

  assert.match(
    migration,
    /insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)/,
  );
  assert.match(
    migration,
    /values \('firework-previews', 'firework-previews', true, 1048576, array\['image\/webp'\]\)/,
  );
  assert.doesNotMatch(migration, /create policy[\s\S]*?on storage\.objects/i);
});

test('generated database types expose the preview manifest and all source relationships', () => {
  const types = read('lib/database.types.ts');

  assert.match(types, /firework_preview_images: \{\s*Row: \{/);
  for (const field of [
    'firework_effect_id',
    'firework_id',
    'multishot_id',
    'source_revision',
    'renderer_version',
    'source_signature',
    'storage_path',
    'width',
    'height',
    'captured_at',
  ]) {
    assert.match(types, new RegExp(`${field}:`), field);
  }
  for (const [foreignKey, relation] of [
    ['firework_preview_images_firework_effect_id_fkey', 'firework_effects'],
    ['firework_preview_images_firework_id_fkey', 'fireworks'],
    ['firework_preview_images_multishot_id_fkey', 'multishots'],
  ]) {
    assert.match(types, new RegExp(`foreignKeyName: "${foreignKey}"`), foreignKey);
    assert.match(
      types,
      new RegExp(
        `foreignKeyName: "${foreignKey}"[\\s\\S]*?isOneToOne: true[\\s\\S]*?referencedRelation: "${relation}"`,
      ),
      relation,
    );
  }
});

test('preview URL helpers expose only the current renderer version', () => {
  const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co/';
  try {
    const {
      FIREWORK_PREVIEW_BUCKET,
      FIREWORK_PREVIEW_RENDERER_VERSION,
      fireworkPreviewImageUrl,
      isCurrentFireworkPreviewImagePath,
      resolveFireworkPreviewImage,
      withFireworkPreviewRevision,
    } = loadPreviewImageModule();

    assert.equal(FIREWORK_PREVIEW_BUCKET, 'firework-previews');
    assert.equal(FIREWORK_PREVIEW_RENDERER_VERSION, 'v1');
    assert.equal(isCurrentFireworkPreviewImagePath('v1/firework/item/poster.webp'), true);
    assert.equal(isCurrentFireworkPreviewImagePath('v0/firework/item/poster.webp'), false);
    assert.deepEqual(
      resolveFireworkPreviewImage({
        source_revision: 4,
        renderer_version: 'v1',
        storage_path: 'v1/firework/item/poster.webp',
      }),
      {
        previewImagePath: 'v1/firework/item/poster.webp',
        previewImageRevision: 4,
      },
    );
    assert.deepEqual(
      resolveFireworkPreviewImage({
        source_revision: 5,
        renderer_version: 'v0',
        storage_path: 'v0/firework/item/poster.webp',
      }),
      { previewImagePath: null, previewImageRevision: 5 },
    );
    assert.equal(
      fireworkPreviewImageUrl('v1/firework/item/poster.webp'),
      'https://example.supabase.co/storage/v1/object/public/firework-previews/v1/firework/item/poster.webp',
    );
    assert.equal(fireworkPreviewImageUrl('v0/firework/item/poster.webp'), null);
    assert.equal(withFireworkPreviewRevision('/api/preview', 7), '/api/preview?revision=7');
    assert.equal(
      withFireworkPreviewRevision('/api/preview?kind=firework', 7),
      '/api/preview?kind=firework&revision=7',
    );
  } finally {
    if (previousPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicUrl;
  }
});

test('admin and public list loaders expose persisted poster manifest fields', () => {
  const adminTypes = read('lib/admin.types.ts');
  const effects = read('lib/admin/effects.server.ts');
  const fireworks = read('lib/admin/fireworks.server.ts');
  const multishots = read('lib/admin/multishots.server.ts');
  const catalogue = read('lib/shows/queries.server.ts');
  const showDomain = read('lib/show-domain.ts');

  assert.equal(adminTypes.match(/previewImagePath: string \| null/g)?.length, 3);
  assert.equal(adminTypes.match(/previewImageRevision: number \| null/g)?.length, 3);
  for (const [name, source] of [
    ['effects', effects],
    ['fireworks', fireworks],
    ['multishots', multishots],
  ]) {
    assert.match(
      source,
      /firework_preview_images\(source_revision, renderer_version, storage_path\)/,
      name,
    );
    assert.match(source, /resolveFireworkPreviewImage\(/, name);
  }
  assert.match(
    catalogue,
    /firework_preview_images\(source_revision, renderer_version, storage_path\)/,
  );
  assert.match(catalogue, /resolveFireworkPreviewImage\(/);
  assert.match(showDomain, /previewImagePath\?: string \| null/);
  assert.match(showDomain, /previewImageRevision\?: number \| null/);
});

test('admin POST validates WebP capture metadata and the catalogue route stays read-only', () => {
  const adminRoute = read('app/api/admin/firework-previews/[kind]/[id]/route.ts');
  const packageJson = JSON.parse(read('package.json'));
  const publicRoute = read('app/api/catalogue/[id]/preview/route.ts');

  assert.equal(adminRoute.match(/requirePermission\('admin\.manage_catalogue'\)/g)?.length, 2);
  assert.equal(packageJson.dependencies.sharp, '^0.34.5');
  assert.match(adminRoute, /import sharp from 'sharp'/);
  assert.match(adminRoute, /const MAX_POSTER_BYTES = 1024 \* 1024/);
  assert.match(adminRoute, /const MAX_POSTER_INPUT_PIXELS = POSTER_WIDTH \* POSTER_HEIGHT/);
  assert.match(adminRoute, /contentType !== 'image\/webp'/);
  assert.match(adminRoute, /image\.toString\('ascii', 0, 4\) === 'RIFF'/);
  assert.match(adminRoute, /image\.toString\('ascii', 8, 12\) === 'WEBP'/);
  assert.match(adminRoute, /totalBytes > MAX_POSTER_BYTES/);
  assert.match(adminRoute, /animated: true/);
  assert.match(adminRoute, /failOn: 'warning'/);
  assert.match(adminRoute, /limitInputPixels: MAX_POSTER_INPUT_PIXELS/);
  assert.match(adminRoute, /metadata\.format !== 'webp'/);
  assert.match(adminRoute, /metadata\.width !== POSTER_WIDTH/);
  assert.match(adminRoute, /metadata\.height !== POSTER_HEIGHT/);
  assert.match(adminRoute, /\(metadata\.pages \?\? 1\) !== 1/);
  assert.match(adminRoute, /\.raw\(\)\.toBuffer\(\{ resolveWithObject: true \}\)/);
  assert.match(adminRoute, /!isWebp\(image\) \|\| !\(await isValidPosterWebp\(image\)\)/);
  assert.match(adminRoute, /metadata\.kind !== kind \|\| metadata\.sourceId !== id/);

  for (const header of [
    'X-Firework-Preview-Kind',
    'X-Firework-Preview-Source-Id',
    'X-Firework-Preview-Source-Revision',
    'X-Firework-Preview-Source-Signature',
    'X-Firework-Preview-Expected-Path',
    'X-Firework-Preview-Width',
    'X-Firework-Preview-Height',
  ]) {
    assert.match(adminRoute, new RegExp(`request\\.headers\\.get\\('${header}'\\)`), header);
  }

  assert.match(adminRoute, /export async function POST/);
  assert.doesNotMatch(publicRoute, /export async function POST/);
  assert.doesNotMatch(publicRoute, /requirePermission/);
});

test('poster persistence uses immutable versioned paths and guarded manifest publication', () => {
  const source = read('lib/firework-preview-persistence.server.ts');

  assert.match(source, /createServiceRoleSupabase\(\)/);
  assert.match(source, /loadAdminFireworkCardPreviewForPersistence/);
  assert.match(source, /current\.persistence\.sourceRevision !== input\.sourceRevision/);
  assert.match(source, /current\.persistence\.sourceSignature !== input\.sourceSignature/);
  assert.match(source, /current\.persistence\.expectedStoragePath !== input\.expectedStoragePath/);
  assert.match(source, /createHash\('sha256'\)\.update\(input\.image\)\.digest\('hex'\)/);
  assert.match(
    source,
    /`\$\{FIREWORK_PREVIEW_RENDERER_VERSION\}\/\$\{input\.kind\}\/\$\{input\.sourceId\}\/r\$\{input\.sourceRevision\}-\$\{contentSha\}\.webp`/,
  );
  assert.match(source, /\.from\(FIREWORK_PREVIEW_BUCKET\)[\s\S]*?\.upload\(path, input\.image/);
  assert.match(source, /contentType: 'image\/webp'/);
  assert.match(source, /cacheControl: '31536000'/);
  assert.match(source, /upsert: false/);
  assert.match(source, /\.select\('storage_path'\)/);
  assert.match(source, /manifestBeforeUpload\.storage_path !== input\.expectedStoragePath/);
  assert.match(source, /\.from\('firework_preview_images'\)[\s\S]*?\.update\(/);
  assert.match(source, /\.eq\(MANIFEST_SOURCE_COLUMN\[input\.kind\], input\.sourceId\)/);
  assert.match(source, /\.eq\('source_revision', input\.sourceRevision\)/);
  assert.match(source, /manifestUpdate\.is\('storage_path', null\)/);
  assert.match(source, /manifestUpdate\.eq\('storage_path', input\.expectedStoragePath\)/);
  assert.match(source, /if \(!alreadyExisted\) await removeStorageObject\(service, path\)/);
  assert.match(source, /await removeStorageObject\(service, input\.expectedStoragePath\)/);
  assert.match(source, /invalidateAdminEffectsCache/);
  assert.match(source, /invalidateAdminFireworksCache/);
  assert.match(source, /invalidateAdminMultishotsCache/);
  assert.match(source, /invalidateAdminCatalogueCache\(\)/);
  assert.match(source, /invalidateFireworkCatalogueCaches\(\)/);
  assert.match(source, /revalidatePath\('\/catalogue'\)/);
});
