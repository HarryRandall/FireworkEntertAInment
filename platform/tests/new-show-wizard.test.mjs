/** Static-analysis "grep the source" test guarding the new-show wizard invariants (do not modify test bodies). */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const page = readFileSync(join(root, 'app/(app)/shows/new/page.tsx'), 'utf8');

test('new show wizard only creates a draft from an explicit Generate click', () => {
  // The form's onSubmit advances the wizard but must never call createShowAction.
  const submitGuard = /if \(stepIndex < STEPS\.length - 1\) \{\s+goToStep\(stepIndex \+ 1\);\s+\}/s;
  assert.notEqual(page.search(submitGuard), -1, 'form submit must only advance the wizard');

  // createShowAction is called exactly once, and only from triggerGenerate.
  const createCalls = page.match(/createShowAction\(data\)/g) ?? [];
  assert.equal(createCalls.length, 1, 'createShowAction(data) should appear exactly once');

  const triggerStart = page.indexOf('const triggerGenerate');
  assert.notEqual(triggerStart, -1, 'triggerGenerate function must exist');
  const createCallIdx = page.indexOf('createShowAction(data)');
  assert.ok(createCallIdx > triggerStart, 'createShowAction must live inside triggerGenerate');
});

test('new show wizard uploads audio before final submit', () => {
  assert.match(page, /createSupabaseBrowserClient/);
  assert.match(page, /uploadAudioAndStartAnalysis/);
  assert.match(page, /data\.set\('musicAnalysisId'/);
  assert.doesNotMatch(page, /data\.set\('audio', audioFile\)/);
});

test('new show wizard can prefill a prompt without bypassing the wizard', () => {
  assert.match(page, /useSearchParams/);
  assert.match(page, /searchParams\.get\('prompt'\)/);
  assert.match(page, /setDescription\(prompt\.slice\(0, 2000\)\)/);

  const promptEffectStart = page.indexOf("const prompt = searchParams.get('prompt')");
  assert.notEqual(promptEffectStart, -1, 'prompt prefill effect must exist');
  const promptEffectEnd = page.indexOf('}, [searchParams]);', promptEffectStart);
  assert.notEqual(promptEffectEnd, -1, 'prompt prefill effect must be dependency-scoped');
  const promptEffect = page.slice(promptEffectStart, promptEffectEnd);
  assert.doesNotMatch(promptEffect, /setStepIndex/);
});

test('new show wizard moves ready uploaded music into the AI brief step', () => {
  assert.match(page, /setUploadedAudio\(uploaded\)/);
  assert.match(page, /uploadedAudio &&\s+audioUploadState === 'ready' &&\s+title\.trim\(\)/s);
  assert.match(page, /setStepIndex\(2\)/);
  assert.match(page, /setFieldError\('title'\)/);
  assert.match(page, /focusTitleRequirement\(\)/);
});

test('new show wizard routes to the generation page immediately on launch', () => {
  assert.doesNotMatch(page, /import \{ GeneratingShowAnimation \}/);
  assert.match(page, /const \[isLaunching, setIsLaunching\] = useState\(false\)/);
  assert.doesNotMatch(page, /<GeneratingShowAnimation/);
  assert.match(page, /persistGenerationStartedAt\(desiredSlug\)/);
  assert.match(page, /persistGenerationStartedAt\(result\.slug, generationStartedAt\)/);

  const launchIdx = page.indexOf('setIsLaunching(true)');
  const routeIdx = page.indexOf(
    'router.push(`/shows/${desiredSlug}/generating?creating=1&t=${titleParam}`)',
  );
  const transitionIdx = page.indexOf('startTransition(async () =>');
  assert.notEqual(launchIdx, -1, 'Generate should enter launching state immediately');
  assert.notEqual(routeIdx, -1, 'Generate should navigate to the generating route immediately');
  assert.notEqual(transitionIdx, -1, 'Generate should still run the server action transition');
  assert.ok(launchIdx < routeIdx, 'launching state should be set before navigation');
  assert.ok(routeIdx < transitionIdx, 'navigation should happen before async generation work');
  assert.doesNotMatch(page, /loading=\{isPending\}/);
});

test('new show wizard keeps navigation controls out of submit flow', () => {
  assert.match(page, /type="button"\s+variant="secondary"/);
  assert.match(page, /type="button"\s+onClick=\{\(\) => goToStep\(stepIndex \+ 1\)\}/);
  // Generate button must be type="button" with explicit onClick — never type="submit".
  assert.match(page, /type="button"\s+onClick=\{triggerGenerate\}/);
  assert.doesNotMatch(page, /type="submit"/);
});

test('new show page avoids redundant chrome', () => {
  assert.doesNotMatch(page, /breadcrumbs=\{/);
  assert.doesNotMatch(page, /Draft details/);
  assert.doesNotMatch(page, /sticky bottom/);
});
