/** Static-analysis "grep the source" test guarding the new-show wizard invariants (do not modify test bodies). */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const page = readFileSync(join(root, 'app/(app)/shows/new/page.tsx'), 'utf8');
const choiceCards = readFileSync(join(root, 'app/(app)/shows/new/_components/cards.tsx'), 'utf8');
const audioUpload = readFileSync(
  join(root, 'app/(app)/shows/new/_components/AudioUpload.tsx'),
  'utf8',
);
const actions = readFileSync(join(root, 'app/(app)/shows/new/actions.ts'), 'utf8');
const promptHero = readFileSync(join(root, 'app/components/app/ShowSummaryCards.tsx'), 'utf8');

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
  assert.match(page, /parseMusicAnalysisResponse\(json, response\.ok\)/);
  assert.match(page, /uploadTokenRef\.current !== token/);
  assert.match(page, /storage\.from\(AUDIO_BUCKET\)\.remove\(\[audioPath\]\)/);
});

test('new show wizard reflects the server generation mode and live credit costs', () => {
  assert.match(page, /getShowGenerationPresentationAction/);
  assert.match(page, /generationPresentation\.generationMode === 'llm'/);
  assert.match(page, /Fast planner/);
  assert.match(page, /generationPresentation\.fastCreditCost/);
  assert.match(page, /creditCosts=\{generationPresentation\.modelCreditCosts\}/);
  assert.match(page, /isLaunching \|\| !generationPresentation/);
  assert.match(page, /Retry generation options/);
  assert.match(
    page,
    /data\.set\('expectedGenerationMode', generationPresentation\.generationMode\)/,
  );
  assert.match(actions, /getAiCreditCost/);
  assert.match(actions, /expectedGenerationMode !== generationSettings\.generationMode/);
  assert.match(actions, /generationMode === 'llm' \? requestedCueModel : null/);
  assert.match(actions, /defaultCueModel/);
  assert.match(page, /selectedCueModel \?\? generationPresentation\?\.defaultCueModel/);
  assert.match(page, /generationMode === 'llm' && selectedCueModel/);
  assert.doesNotMatch(promptHero, /params\.set\('model'/);
  assert.doesNotMatch(promptHero, /<CueModelSelect/);
});

test('new show wizard can prefill a prompt and continue to soundtrack', () => {
  assert.match(page, /useSearchParams/);
  assert.match(page, /searchParams\.get\('prompt'\)/);
  assert.match(page, /setDescription\(prompt\.slice\(0, 2000\)\)/);

  const promptEffectStart = page.indexOf("const prompt = searchParams.get('prompt')");
  assert.notEqual(promptEffectStart, -1, 'prompt prefill effect must exist');
  const promptEffectEnd = page.indexOf('}, [searchParams]);', promptEffectStart);
  assert.notEqual(promptEffectEnd, -1, 'prompt prefill effect must be dependency-scoped');
  const promptEffect = page.slice(promptEffectStart, promptEffectEnd);
  assert.match(promptEffect, /setStepIndex\(\(index\) => \(index === 0 \? 1 : index\)\)/);
  assert.doesNotMatch(promptEffect, /createShowAction/);
  assert.doesNotMatch(promptEffect, /triggerGenerate/);
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
  assert.match(page, /resolvePersistedGenerationCover\(desiredSlug\)/);
  assert.match(page, /persistGenerationStartedAt\(result\.slug, generationStartedAt\)/);
  assert.match(page, /data\.set\('coverShader', JSON\.stringify\(generationCover\)\)/);

  const launchIdx = page.indexOf('setIsLaunching(true)');
  const routeIdx = page.indexOf(
    "`/shows/${desiredSlug}/generating?creating=1&t=${titleParam}${hasAudio ? '&a=1' : ''}`",
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

test('new show choice cards stay visible before hover', () => {
  assert.match(choiceCards, /border-2 bg-\[color:var\(--color-bg-elevated\)\]/);
  assert.match(choiceCards, /selected \|\| multi/);
  assert.match(choiceCards, /\? 'border-\[color:var\(--color-content-emphasis\)\]'/);
  assert.doesNotMatch(choiceCards, /ring-ring\/30/);
  assert.doesNotMatch(choiceCards, /bg-\[color:var\(--color-bg-subtle\)\]\/55/);
  assert.doesNotMatch(
    choiceCards,
    /border-\[color:var\(--color-border-subtle\)\] hover:border-\[color:var\(--color-border-default\)\] hover:bg-\[color:var\(--color-bg-subtle\)\]\/50/,
  );

  assert.match(page, /border-2 bg-\[color:var\(--color-bg-elevated\)\]/);
  assert.match(
    page,
    /soundtrackMode === 'none'\s+\? 'border-\[color:var\(--color-content-emphasis\)\]'/,
  );
});

test('new show audio drop zone uses the bright card surface', () => {
  assert.match(audioUpload, /border-2 border-dashed/);
  assert.match(audioUpload, /bg-\[color:var\(--color-bg-elevated\)\]/);
  assert.match(audioUpload, /hover:border-\[color:var\(--color-content-emphasis\)\]\/40/);
  assert.doesNotMatch(audioUpload, /bg-\[color:var\(--color-bg-subtle\)\]\/40/);
  assert.doesNotMatch(audioUpload, /hover:bg-\[color:var\(--color-bg-subtle\)\]/);
  assert.match(audioUpload, /role=\{uploadState === 'error' \? 'alert' : 'status'\}/);
  assert.match(audioUpload, /<AlertTriangle/);
});
