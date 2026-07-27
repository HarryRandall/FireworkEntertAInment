import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('manual analyser warm-up reports success only after the hosted ping succeeds', () => {
  const action = read('app/actions/admin-analyser.ts');

  assert.doesNotMatch(action, /from 'next\/server'/);
  assert.doesNotMatch(action, /\bafter\s*\(/);
  assert.match(action, /await enableAnalyserWarmth\(admin\.id\)/);
  assert.match(action, /await refreshAnalyserWarmth\(\{ force: true \}\)/);
  assert.match(
    action,
    /if \(!result\.ok \|\| !result\.active\) \{[\s\S]*await disableAnalyserWarmth\(\)/,
  );
  assert.ok(
    action.indexOf('await refreshAnalyserWarmth({ force: true })') <
      action.indexOf('return { ok: true, state: result.state }'),
  );
});

test('analyser warmth is public only after a successful ping', () => {
  const warmth = read('lib/analyser-warmth.server.ts');

  assert.match(warmth, /active: stored\.lastWarmupOk === true/);
  assert.match(
    warmth,
    /!force &&\s+stored\.lastWarmupOk === true &&\s+Number\.isFinite\(lastWarmupMs\)/,
  );
  assert.match(
    warmth,
    /return \{ ok: false, active: false, error: result\.error, state: updatedState \}/,
  );
});

test('admin warmth control exposes failed state and does not toast false success', () => {
  const control = read('app/(admin)/admin/AnalyserWarmthControl.tsx');

  assert.match(control, /state\.lastWarmupOk === false/);
  assert.match(control, /if \(result\.state\) setState\(result\.state\)/);
  assert.match(
    control,
    /toast\.error\('Analyser did not warm up', \{ description: result\.error \}\)/,
  );
  assert.match(control, /\{active \? 'Live' : failed \? 'Failed' : 'Idle'\}/);
  assert.ok(
    control.indexOf("toast.success('Analyser live for 30 minutes')") >
      control.indexOf('if (!result.ok)'),
  );
});
