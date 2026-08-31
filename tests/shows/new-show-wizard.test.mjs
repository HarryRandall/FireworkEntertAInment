/** Static-analysis tests guarding the new-show wizard's interaction and creation invariants. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const serverPage = readFileSync(join(root, 'app/(app)/shows/new/page.tsx'), 'utf8');
const page = readFileSync(join(root, 'app/(app)/shows/new/NewShowPageClient.tsx'), 'utf8');
const choiceCards = readFileSync(join(root, 'app/(app)/shows/new/_components/cards.tsx'), 'utf8');
const audioUpload = readFileSync(
  join(root, 'app/(app)/shows/new/_components/AudioUpload.tsx'),
  'utf8',
);
const actions = readFileSync(join(root, 'app/(app)/shows/new/actions.ts'), 'utf8');
const promptHero = readFileSync(join(root, 'components/shows/ShowSummaryCards.tsx'), 'utf8');

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
  assert.match(serverPage, /await Promise\.race\(\[[\s\S]*getShowGenerationPresentationAction\(\)/);
  assert.match(serverPage, /initialGenerationPresentation/);
  assert.match(serverPage, /INITIAL_GENERATION_PRESENTATION_TIMEOUT_MS = 12_000/);
  assert.match(page, /getShowGenerationPresentationAction/);
  assert.match(page, /GENERATION_PRESENTATION_TIMEOUT_MS = 12_000/);
  assert.match(
    page,
    /useState<ShowGenerationPresentation \| null>\(initialGenerationPresentation\)/,
  );
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
  assert.match(page, /!usesBeatPrecision &&\s+generationPresentation\.generationMode === 'llm'/s);
  assert.match(promptHero, /params\.set\('model', selectedCueModel\)/);
  assert.match(promptHero, /<CueModelSelect/);
});

test('new show wizard exposes real shared show styles', () => {
  assert.match(page, /SHOW_STYLE_LIST\.map/);
  assert.match(page, /setStyleKey\(style\.key\)/);
  assert.match(page, /type="radio"\s+name="showStyle"/);
  assert.match(page, /checked=\{selected\}/);
  assert.doesNotMatch(page, /role="radiogroup"/);
  assert.doesNotMatch(page, /role="radio"/);
  assert.match(page, /data\.set\('showStyle', styleKey\)/);
  assert.match(page, /usesBeatPrecision \|\| fireworkTypes\.has\('aerial_shells'\)/);
  assert.match(actions, /Beat precision needs Aerial shells selected/);
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

test('new show wizard advances ready uploaded music without hidden title validation', () => {
  assert.match(page, /setUploadedAudio\(uploaded\)/);
  assert.match(page, /uploadedAudio &&\s+audioUploadState === 'ready'/s);
  assert.match(page, /setStepIndex\(2\)/);
  assert.doesNotMatch(page, /setFieldError\('title'\)/);
  assert.doesNotMatch(page, /focusTitleRequirement/);
  assert.doesNotMatch(page, /type="hidden" name="title"/);
  assert.match(page, /deriveTitleFromDescription\(description\)/);
});

test('new show wizard blocks invalid measured widths instead of substituting a preset', () => {
  assert.match(page, /const measuredWidthError =/);
  assert.match(page, /!Number\.isInteger\(measuredFeet\)/);
  assert.match(page, /measuredFeet < 5/);
  assert.match(page, /measuredFeet > 2000/);
  assert.match(page, /if \(measuredWidthError\) \{/);
  assert.match(page, /Boolean\(measuredWidthError\)/);
  assert.match(page, /invalid=\{Boolean\(measuredWidthError\)\}/);
  assert.match(page, /role="alert"/);
  assert.match(page, /data\.set\('siteWidthFeet', String\(effectiveWidthFeet\)\)/);
});

test('new show wizard returns blocking upload errors to the visible soundtrack step', () => {
  assert.match(page, /const returnToSoundtrackUploadError = \(message: string\)/);
  assert.match(page, /shouldFocusAudioUploadErrorRef\.current = true/);
  assert.match(page, /setAudioUploadState\('error'\)/);
  assert.match(page, /setStepIndex\(1\)/);
  assert.match(page, /audioUploadErrorRef\.current\?\.focus\(\)/);
  assert.match(page, /Track upload error:/);
});

test('new show wizard uses labelled native selection controls', () => {
  assert.match(page, /htmlFor="show-description"/);
  assert.match(page, /id="show-description"/);
  assert.match(page, /aria-describedby="show-description-hint"/);
  assert.match(page, /htmlFor="measured-site-width"/);
  assert.match(page, /id="measured-site-width"/);
  assert.match(choiceCards, /type: 'radio' \| 'checkbox'/);
  assert.match(choiceCards, /<input\s+type=\{type\}/s);
  assert.match(choiceCards, /name=\{name\}/);
  assert.match(choiceCards, /checked=\{selected\}/);
  assert.match(page, /type="checkbox"\s+name="fireworkTypes"/);
});

test('radio-card answers stay on screen for keyboard review before continuing', () => {
  assert.match(page, /onSelect=\{\(\) => setLengthChoice\('match'\)\}/);
  assert.match(page, /onSelect=\{\(\) => setLengthChoice\(option\.minutes\)\}/);
  assert.match(page, /onSelect=\{\(\) => setBudget\(tier\.value\)\}/);
  assert.doesNotMatch(
    page,
    /onSelect=\{\(\) => \{\s*set(?:LengthChoice|Budget)\([^;]+;\s*goToStep\(stepIndex \+ 1\)/s,
  );
  assert.doesNotMatch(choiceCards, /onClick=\{\(event\) =>/);
});

test('single-choice steps keep a primary Continue action in place, disabled until a selection', () => {
  // The Continue button is always rendered (no layout shift when selecting) and
  // is simply disabled until the step has a value.
  assert.match(
    page,
    /<div className="flex justify-center pt-2">\s*<Button[\s\S]*?disabled=\{mounted && lengthChoice === null\}[\s\S]*?Continue[\s\S]*?<ArrowRight size=\{16\} \/>/,
  );
  assert.match(
    page,
    /<div className="flex justify-center pt-5">\s*<Button[\s\S]*?disabled=\{mounted && budget === null\}[\s\S]*?Continue[\s\S]*?<ArrowRight size=\{16\} \/>/,
  );
  // The Continue button must not be gated behind a selection-only conditional
  // (that is what caused the vertical shift).
  assert.doesNotMatch(page, /\{lengthChoice !== null \? \(/);
  assert.doesNotMatch(page, /\{budget !== null \? \(/);
  // Skip stays in the footer for these steps regardless of selection.
  assert.doesNotMatch(page, /stepIndex === 2 && lengthChoice !== null/);
  assert.doesNotMatch(page, /stepIndex === 3 && budget !== null/);
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
  assert.match(choiceCards, /selected \|\| multiple/);
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
