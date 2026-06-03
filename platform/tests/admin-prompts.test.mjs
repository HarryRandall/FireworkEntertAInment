/** Static guards for the admin prompt-control workflow. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const repoRoot = join(root, '..');

test('admin prompt route and navigation are present', () => {
  assert.equal(existsSync(join(root, 'app/(admin)/admin/prompts/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/actions/admin-prompts.ts')), true);

  const page = readFileSync(join(root, 'app/(admin)/admin/prompts/page.tsx'), 'utf8');
  const productFieldsDialog = readFileSync(
    join(root, 'app/(admin)/admin/prompts/ProductCatalogueFieldsControl.tsx'),
    'utf8',
  );
  const shell = readFileSync(join(root, 'app/components/admin/AdminShell.tsx'), 'utf8');
  assert.match(page, /PromptTabs/);
  assert.match(page, /Suspense/);
  assert.match(page, /PromptContentSkeleton/);
  assert.match(page, /getAdminPromptControlData/);
  assert.match(page, /\/admin\/prompts\?tab=\$\{tab\.key\}/);
  assert.match(page, /GenerationModeControl/);
  assert.match(page, /ProductCatalogueFieldsControl/);
  assert.match(page, /Show prompt/);
  assert.match(page, /Product context/);
  assert.match(page, /Video prompt/);
  assert.match(page, /textareaKey = `\$\{prompt\.key\}:\$\{fieldName\}:\$\{prompt\.updatedAt\}`/);
  assert.match(page, /fieldName === 'productContextText'/);
  assert.match(productFieldsDialog, /Catalogue fields/);
  assert.match(productFieldsDialog, /PRODUCT_CATALOGUE_FIELD_KEYS/);
  assert.match(shell, /\/admin\/prompts/);
  assert.match(shell, /MessageSquareText/);
});

test('prompt config migration creates admin-managed prompt rows', () => {
  const migration = readFileSync(
    join(root, 'supabase/migrations/20260603090000_prompt_configs.sql'),
    'utf8',
  );

  assert.match(migration, /create table if not exists public\.prompt_configs/);
  assert.match(migration, /system_prompt_text text not null/);
  assert.match(migration, /product_context_text text/);
  assert.match(migration, /admin\.manage_prompts/);
  assert.match(migration, /current_user_has_permission\('admin\.manage_prompts'\)/);
  assert.match(migration, /show_cue_generation/);
  assert.match(migration, /firework_video_reconstruction/);
  assert.match(migration, /join public\.permissions p on p\.key = 'admin\.manage_prompts'/);

  const settingsMigration = readFileSync(
    join(root, 'supabase/migrations/20260603091000_generation_settings.sql'),
    'utf8',
  );
  assert.match(settingsMigration, /create table if not exists public\.generation_settings/);
  assert.match(settingsMigration, /generation_mode text not null default 'fast'/);
  assert.match(settingsMigration, /generation_mode in \('fast', 'llm'\)/);
  assert.match(settingsMigration, /admin\.manage_prompts/);

  const fieldsMigration = readFileSync(
    join(root, 'supabase/migrations/20260603092000_generation_product_fields.sql'),
    'utf8',
  );
  assert.match(fieldsMigration, /add column if not exists product_catalogue_fields jsonb/);
  assert.match(fieldsMigration, /jsonb_typeof\(product_catalogue_fields\) = 'array'/);
  assert.match(fieldsMigration, /"colorPalette"/);
});

test('cue generation loads saved mode and prompt config', () => {
  const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');
  const prompt = readFileSync(join(root, 'lib/cue-generation/prompt.ts'), 'utf8');
  const promptServer = readFileSync(join(root, 'lib/prompt-configs.server.ts'), 'utf8');

  assert.match(runner, /generationSettings = await getShowCueGenerationSettings\(\)/);
  assert.match(runner, /if \(generationMode === 'fast'\)/);
  assert.match(runner, /getActivePromptConfig\('show_cue_generation'\)/);
  assert.match(runner, /systemPromptText: promptConfig\?\.systemPromptText/);
  assert.match(runner, /productContextText: promptConfig\?\.productContextText/);
  assert.match(runner, /productCatalogueFields: generationSettings\.productCatalogueFields/);
  assert.match(runner, /productIndex = new Map\(products\.map/);
  assert.match(runner, /productIndex\.get\(cue\.productId\)/);
  assert.match(promptServer, /getDefaultShowGenerationSettings/);
  assert.match(promptServer, /process\.env\.CUE_GENERATION_MODE === 'llm'/);
  assert.match(promptServer, /product_catalogue_fields/);
  assert.match(promptServer, /\.from\('generation_settings'\)/);
  assert.match(prompt, /DEFAULT_SHOW_CUE_SYSTEM_PROMPT/);
  assert.match(prompt, /DEFAULT_SHOW_CUE_PRODUCT_CONTEXT_TEXT/);
  assert.match(prompt, /selectedFields\?: readonly ProductCatalogueField\[\] \| null/);
  assert.match(prompt, /Catalogue fields sent in this request/);
  assert.match(prompt, /compactText\(product\.description, 140\)/);
});

test('admin prompt action is RBAC gated and invalidates prompt cache', () => {
  const action = readFileSync(join(root, 'app/actions/admin-prompts.ts'), 'utf8');
  const helpers = readFileSync(join(root, 'lib/admin/prompts.server.ts'), 'utf8');
  const cacheKeys = readFileSync(join(root, 'lib/admin/cache-keys.ts'), 'utf8');

  assert.match(action, /requirePermission\('admin\.manage_prompts'\)/);
  assert.match(action, /\.from\('prompt_configs'\)/);
  assert.match(action, /updateShowGenerationModeAction/);
  assert.match(action, /\.from\('generation_settings'\)\.upsert/);
  assert.match(action, /product_catalogue_fields/);
  assert.match(action, /asProductCatalogueFields/);
  assert.match(action, /invalidateAdminPromptConfigsCache/);
  assert.match(action, /revalidatePath\('\/admin\/prompts'\)/);
  assert.match(helpers, /listAdminPromptConfigs/);
  assert.match(helpers, /getAdminShowGenerationSetting/);
  assert.match(helpers, /getAdminPromptControlData/);
  assert.match(helpers, /\[cachedConfigs, cachedGenerationSetting\] = await Promise\.all/);
  assert.match(helpers, /requirePermission\('admin\.manage_prompts'\)/);
  assert.match(cacheKeys, /getAdminPromptConfigsCacheKey/);
  assert.match(cacheKeys, /getAdminGenerationSettingsCacheKey/);
});

test('firework import worker fetches saved reconstruction prompt with fallback', () => {
  const worker = readFileSync(join(repoRoot, 'workers/firework-import-worker/worker.py'), 'utf8');

  assert.match(worker, /PROMPT_CONFIGS_TABLE = "prompt_configs"/);
  assert.match(worker, /def fetch_prompt_config/);
  assert.match(worker, /\.eq\("key", key\)/);
  assert.match(worker, /prompt config fallback/);
  assert.match(worker, /"firework_video_reconstruction"/);
  assert.match(worker, /reconstruction_prompt/);
  assert.match(worker, /if isinstance\(reconstruction_prompt, str\)/);
});
