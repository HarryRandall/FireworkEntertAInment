/** Static guards for the admin prompt-control workflow. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const repoRoot = root;

test('admin prompt route and navigation are present', () => {
  assert.equal(existsSync(join(root, 'app/(admin)/admin/prompts/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(admin)/admin/prompts/actions.ts')), true);

  const page = readFileSync(join(root, 'app/(admin)/admin/prompts/page.tsx'), 'utf8');
  const productFieldsDialog = readFileSync(
    join(root, 'app/(admin)/admin/prompts/_components/ProductCatalogueFieldsControl.tsx'),
    'utf8',
  );
  const promptForm = readFileSync(
    join(root, 'app/(admin)/admin/prompts/_components/PromptConfigForm.tsx'),
    'utf8',
  );
  const shell = readFileSync(join(root, 'ui/shell/AdminShell.tsx'), 'utf8');
  assert.match(page, /PromptTabs/);
  assert.match(page, /Suspense/);
  assert.match(page, /PromptContentSkeleton/);
  assert.match(page, /getAdminPromptControlData/);
  assert.match(page, /\/admin\/prompts\?tab=\$\{tab\.key\}/);
  assert.match(page, /GenerationModeControl/);
  assert.match(page, /PromptConfigForm/);
  assert.match(page, /PromptSaveButton/);
  assert.match(page, /ProductCatalogueFieldsControl/);
  assert.match(page, /Show prompt/);
  assert.match(page, /Product context/);
  assert.match(page, /Video prompt/);
  assert.match(page, /textareaKey = `\$\{prompt\.key\}:\$\{fieldName\}:\$\{prompt\.updatedAt\}`/);
  assert.match(page, /fieldName === 'productContextText'/);
  assert.match(productFieldsDialog, /Catalogue fields/);
  assert.match(productFieldsDialog, /PRODUCT_CATALOGUE_FIELD_KEYS/);
  assert.match(productFieldsDialog, /resetVersion/);
  assert.match(promptForm, /useActionState\(updatePromptConfigAction, INITIAL_STATE\)/);
  assert.match(promptForm, /action=\{formAction\}/);
  assert.match(promptForm, /event\.preventDefault\(\)/);
  assert.match(promptForm, /startTransition\(\(\) => formAction\(formData\)\)/);
  assert.match(promptForm, /<fieldset disabled=\{isPending\}/);
  assert.match(promptForm, /aria-busy=\{isPending \|\| undefined\}/);
  assert.match(promptForm, /<InlineAlert/);
  assert.match(promptForm, /loading=\{isPending\}/);
  assert.match(shell, /\/admin\/prompts/);
  assert.match(shell, /MessageSquareText/);
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
  const action = readFileSync(join(root, 'app/(admin)/admin/prompts/actions.ts'), 'utf8');
  const helpers = readFileSync(join(root, 'lib/admin/prompts.server.ts'), 'utf8');
  const cacheKeys = readFileSync(join(root, 'lib/admin/cache-keys.ts'), 'utf8');

  assert.match(action, /requirePermission\('admin\.manage_prompts'\)/);
  assert.match(action, /\.rpc\('update_prompt_config_atomically', update\)/);
  assert.match(action, /updateShowGenerationModeAction/);
  assert.match(action, /\.rpc\('update_show_generation_mode'/);
  assert.doesNotMatch(action, /\.from\('prompt_configs'\)/);
  assert.doesNotMatch(action, /\.from\('generation_settings'\)/);
  assert.match(action, /p_product_catalogue_fields/);
  assert.match(action, /asProductCatalogueFields/);
  assert.match(action, /data !== true/);
  assert.match(action, /PromptConfigActionState/);
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

test('firework import worker layers saved guidance over its immutable reconstruction contract', () => {
  const worker = readFileSync(
    join(repoRoot, '../../services/firework-import-worker/worker.py'),
    'utf8',
  );

  assert.match(worker, /PROMPT_CONFIGS_TABLE = "prompt_configs"/);
  assert.match(worker, /def fetch_prompt_config/);
  assert.match(worker, /\.eq\("key", key\)/);
  assert.match(worker, /\.eq\("is_active", True\)/);
  assert.match(worker, /def effective_reconstruction_system_prompt/);
  assert.match(worker, /system_prompt = DEFAULT_RECONSTRUCTION_SYSTEM_PROMPT/);
  assert.match(worker, /admin-authored guidance is subordinate to the strict API schema/);
  assert.match(worker, /"firework_video_reconstruction"/);
  assert.match(worker, /reconstruction_prompt/);
  assert.match(worker, /if isinstance\(reconstruction_prompt, str\)/);
});
