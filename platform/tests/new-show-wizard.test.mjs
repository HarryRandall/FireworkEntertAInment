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
