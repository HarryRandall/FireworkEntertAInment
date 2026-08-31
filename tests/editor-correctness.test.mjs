import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeOptimisticEditorVersion } from '../app/components/admin/useEditorHistory.ts';
import { canApplySavedEditorSnapshot } from '../lib/admin/editor-save-state.ts';
import {
  isMissingEditorVersionTableError,
  isMissingStyleDefaultEditorVersionColumnError,
} from '../lib/admin/style-default-schema.ts';
import { nonNegativeRangeFromMidpoint } from '../lib/fireworks/editor-ranges.ts';
import {
  replayCuesSimulationKey,
  replaySimulationCacheKey,
} from '../lib/fireworks/replay-cache-key.ts';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} not found`);
  const openParen = source.indexOf('(', start);
  let parenDepth = 0;
  let closeParen = -1;
  for (let index = openParen; index < source.length; index += 1) {
    if (source[index] === '(') parenDepth += 1;
    if (source[index] === ')') parenDepth -= 1;
    if (parenDepth === 0) {
      closeParen = index;
      break;
    }
  }
  assert.notEqual(closeParen, -1, `${name} parameters were not closed`);
  const brace = source.indexOf('{', closeParen);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(brace + 1, index);
  }
  throw new Error(`${name} body was not closed`);
}

function assertBefore(source, first, second, message) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.notEqual(firstIndex, -1, `${first} not found`);
  assert.notEqual(secondIndex, -1, `${second} not found`);
  assert.ok(firstIndex < secondIndex, message);
}

function makeCue() {
  return {
    id: 'cue-1',
    position: 1,
    timeSeconds: 1.25,
    productId: 'catalogue-1',
    seedOverride: 42,
    launchPositionIndex: 1,
    emphasis: 'normal',
    shotPanDegrees: 4,
    shotTiltDegrees: -3,
    shotPositionOverride: { x: 10, y: 20, z: 30 },
    firework: {
      id: 'firework-1',
      caliber: '30mm',
      durationSeconds: 4.2,
      renderDesign: { size: 60, burst: { speed: [2, 4] } },
      rawSpec: null,
    },
  };
}

test('replay simulation signatures change for every cue input used by the engine', () => {
  const baseCue = makeCue();
  const baseKey = replayCuesSimulationKey([baseCue]);
  const mutations = [
    (cue) => (cue.id = 'cue-2'),
    (cue) => (cue.position = 2),
    (cue) => (cue.timeSeconds = 1.5),
    (cue) => (cue.productId = 'catalogue-2'),
    (cue) => (cue.firework.id = 'firework-2'),
    (cue) => (cue.launchPositionIndex = 2),
    (cue) => (cue.seedOverride = 43),
    (cue) => (cue.emphasis = 'peak'),
    (cue) => (cue.shotPanDegrees = 5),
    (cue) => (cue.shotTiltDegrees = -4),
    (cue) => (cue.shotPositionOverride.x = 11),
    (cue) => (cue.shotPositionOverride.y = 21),
    (cue) => (cue.shotPositionOverride.z = 31),
    (cue) => (cue.firework.caliber = '50mm'),
    (cue) => (cue.firework.durationSeconds = 5),
    (cue) => (cue.firework.renderDesign.size = 61),
  ];

  for (const mutate of mutations) {
    const changedCue = structuredClone(baseCue);
    mutate(changedCue);
    assert.notEqual(replayCuesSimulationKey([changedCue]), baseKey);
  }

  assert.equal(replayCuesSimulationKey([structuredClone(baseCue)]), baseKey);
});

test('snapshot cache signatures include every launch-position coordinate', () => {
  const cue = makeCue();
  const positions = [
    { x: -100, y: 0, z: 20 },
    { x: 100, y: 0, z: 20 },
  ];
  const baseKey = replaySimulationCacheKey([cue], positions);

  for (const axis of ['x', 'y', 'z']) {
    const changedPositions = structuredClone(positions);
    changedPositions[1][axis] += 1;
    assert.notEqual(replaySimulationCacheKey([cue], changedPositions), baseKey);
  }
});

test('editor ranges never emit negative speed or life endpoints', () => {
  assert.deepEqual(nonNegativeRangeFromMidpoint(0.5, 0.6), [0, 1.1]);
  assert.deepEqual(nonNegativeRangeFromMidpoint(4.8, 0.6), [4.2, 5.4]);
  assert.deepEqual(nonNegativeRangeFromMidpoint(-2, -1), [0, 0]);
});

test('save completion only replaces the local snapshot when no newer edit exists', () => {
  assert.equal(canApplySavedEditorSnapshot('same', 'same'), true);
  assert.equal(canApplySavedEditorSnapshot('request', 'newer-edit'), false);
});

test('editor history schema fallbacks only swallow the expected table or new column', () => {
  assert.equal(
    isMissingEditorVersionTableError({
      code: 'PGRST205',
      message: "Could not find the table 'public.firework_editor_versions' in the schema cache",
    }),
    true,
  );
  assert.equal(
    isMissingStyleDefaultEditorVersionColumnError({
      code: 'PGRST204',
      message:
        "Could not find the 'firework_style_default_id' column of 'firework_editor_versions' in the schema cache",
    }),
    true,
  );
  assert.equal(
    isMissingStyleDefaultEditorVersionColumnError({
      code: '42703',
      message: 'column unrelated_field does not exist',
    }),
    false,
  );
});

test('optimistic editor versions map exactly one target before persistence', () => {
  const targetId = 'target-id';
  const cases = [
    {
      targetKind: 'firework',
      fireworkId: targetId,
      fireworkEffectId: null,
      fireworkStyleDefaultId: null,
    },
    {
      targetKind: 'effect',
      fireworkId: null,
      fireworkEffectId: targetId,
      fireworkStyleDefaultId: null,
    },
    {
      targetKind: 'style_default',
      fireworkId: null,
      fireworkEffectId: null,
      fireworkStyleDefaultId: targetId,
    },
  ];

  for (const expected of cases) {
    const version = makeOptimisticEditorVersion({
      id: `${expected.targetKind}-version`,
      targetKind: expected.targetKind,
      targetId,
      action: 'update',
    });
    assert.equal(version.targetKind, expected.targetKind);
    assert.equal(version.fireworkId, expected.fireworkId);
    assert.equal(version.fireworkEffectId, expected.fireworkEffectId);
    assert.equal(version.fireworkStyleDefaultId, expected.fireworkStyleDefaultId);
    assert.equal(version.summary, 'Saving editor changes');
    assert.equal(version.createdByLabel, 'You');
  }

  const restore = makeOptimisticEditorVersion({
    id: 'restore-version',
    targetKind: 'effect',
    targetId,
    action: 'restore',
  });
  assert.equal(restore.summary, 'Restoring saved version');
});

test('editor saves are optimistic while history persistence stays observed and live', () => {
  const effectActions = read('app/actions/admin-effects.ts');
  const fireworkActions = read('app/actions/admin-fireworks.ts');
  const styleDefaultActions = read('app/actions/admin-style-defaults.ts');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const styleDefaultEditor = read('app/(admin)/admin/effects/defaults/[id]/StyleDefaultEditor.tsx');
  const effectServer = read('lib/admin/effects.server.ts');
  const fireworkServer = read('lib/admin/fireworks.server.ts');
  const styleDefaultServer = read('lib/admin/style-defaults.server.ts');
  const editorVersions = read('lib/admin/editor-versions.server.ts');
  const editorHistoryState = read('app/components/admin/useEditorHistory.ts');
  const historyPanel = read('app/components/admin/EditorInspectorPanels.tsx');
  const sliderField = read('app/components/ui/SliderField.tsx');

  for (const actions of [effectActions, fireworkActions, styleDefaultActions]) {
    assert.match(actions, /history insert failed/);
    assert.match(actions, /historyRecorded: boolean/);
    assert.match(actions, /historyVersionId: z\.string\(\)\.uuid\(\)\.optional\(\)/);
    assert.match(actions, /historyVersionId: parsed\.data\.historyVersionId/);
    assert.match(
      actions,
      /const historyRecorded = await record(?:Effect|Firework|StyleDefault)Version/,
    );
    assert.match(actions, /\.catch\(\s*\(historyError: unknown\) =>/);
    assert.match(actions, /id: input\.historyVersionId \?\? crypto\.randomUUID\(\)/);
    assert.match(actions, /historyVersion/);
    assert.match(actions, /created_at: version\.createdAt/);
    assert.match(actions, /return \{ ok: true,[\s\S]*historyVersion, historyRecorded \}/);
    assert.doesNotMatch(actions, /from 'next\/server'/);
    assert.doesNotMatch(actions, /\bafter\(/);
    assert.doesNotMatch(actions, /confirm(?:Effect|Firework|StyleDefault)EditorVersions/);
  }

  const observedMutations = [
    [effectActions, 'updateEffect', 'recordEffectVersion', 'await Promise.all'],
    [
      effectActions,
      'createStyleDefaultAndUpdateEffect',
      'recordEffectVersion',
      'await Promise.all',
    ],
    [effectActions, 'restoreEffectEditorVersion', 'recordEffectVersion', 'await Promise.all'],
    [fireworkActions, 'updateFirework', 'recordFireworkVersion', 'await refresh'],
    [
      fireworkActions,
      'createStyleDefaultAndUpdateFirework',
      'recordFireworkVersion',
      'await refresh',
    ],
    [fireworkActions, 'restoreFireworkEditorVersion', 'recordFireworkVersion', 'await refresh'],
    [styleDefaultActions, 'updateStyleDefault', 'recordStyleDefaultVersion', 'await refresh'],
    [styleDefaultActions, 'archiveStyleDefault', 'recordStyleDefaultVersion', 'await refresh'],
    [
      styleDefaultActions,
      'restoreStyleDefaultEditorVersion',
      'recordStyleDefaultVersion',
      'await refresh',
    ],
  ];
  for (const [actions, name, recordCall, invalidationCall] of observedMutations) {
    const body = functionBody(actions, name);
    assert.match(body, /historyRecorded/);
    assert.match(
      body,
      /historyVersionId: parsed\.data\.(?:historyVersionId|effect\.historyVersionId|firework\.historyVersionId)/,
    );
    assertBefore(
      body,
      `await ${recordCall}`,
      invalidationCall,
      `${name} must observe history before invalidating caches`,
    );
  }

  for (const editor of [effectEditor, fireworkEditor, styleDefaultEditor]) {
    assert.match(editor, /canApplySavedEditorSnapshot/);
    assert.match(editor, /newer edits remain unsaved/);
    assert.match(editor, /savedSnapshotRef/);
    assert.match(editor, /currentSignatureRef\.current !== savedSignatureRef\.current/);
    assert.match(
      editor,
      /function revertLocalChanges\(\) \{\s*const savedSnapshot = savedSnapshotRef\.current/,
    );
    assert.doesNotMatch(editor, /setSavedSignature\(null\)/);
    assert.match(
      editor,
      /useLayoutEffect\(\(\) => \{\s*currentSignatureRef\.current = currentSignature/,
    );
    assert.match(editor, /function beginOptimisticMutation\(/);
    assert.match(editor, /function rollbackOptimisticMutation\(/);
    assert.match(editor, /editorTargetIdRef\.current =/);
    assert.match(editor, /if \(editorTargetIdRef\.current !== mutation\.targetId\) return;/);
    assert.match(editor, /makeOptimisticEditorVersion\(/);
    assert.match(editor, /editorHistory\.begin\(/);
    assert.match(editor, /editorHistory\.discard\(mutation\.historyVersionId\)/);
    assert.match(editor, /recorded: (?:persisted|result)\.historyRecorded/);
    assert.doesNotMatch(editor, /router\.refresh\(\)/);
    assert.doesNotMatch(editor, /confirm(?:Effect|Firework|StyleDefault)EditorVersions/);
  }

  const optimisticSaves = [
    [effectEditor, 'saveEffect', 'persistEffect'],
    [fireworkEditor, 'save', 'persistFirework'],
    [styleDefaultEditor, 'save', 'updateStyleDefault'],
  ];
  for (const [editor, saveName, persistCall] of optimisticSaves) {
    const body = functionBody(editor, saveName);
    assertBefore(
      body,
      'const mutation = beginOptimisticMutation',
      'startTransition',
      `${saveName} must update the UI before starting persistence`,
    );
    assert.match(body, new RegExp(`await ${persistCall}\\(`));
    assert.match(body, /historyVersionId: mutation\.historyVersionId/);
    assert.match(body, /rollbackOptimisticMutation\(mutation\)/);
  }
  assert.match(
    functionBody(effectEditor, 'persistEffect'),
    /historyVersionId: args\.historyVersionId/,
  );
  assert.match(
    functionBody(fireworkEditor, 'persistFirework'),
    /historyVersionId: args\.historyVersionId/,
  );

  for (const [editor, name] of [
    [effectEditor, 'restoreVersion'],
    [fireworkEditor, 'restoreVersion'],
    [styleDefaultEditor, 'restoreVersion'],
    [styleDefaultEditor, 'archiveDefault'],
  ]) {
    const body = functionBody(editor, name);
    assertBefore(
      body,
      'const mutation = beginOptimisticMutation',
      'startTransition',
      `${name} must update the UI before starting persistence`,
    );
    assert.match(body, /historyVersionId: mutation\.historyVersionId/);
    assert.match(body, /rollbackOptimisticMutation\(mutation\)/);
  }

  assert.match(effectActions, /select\(EFFECT_MUTATION_SELECT\)/);
  assert.match(effectActions, /mapSavedEffect\(data as EffectMutationRow\)/);
  assert.match(fireworkActions, /select\(FIREWORK_MUTATION_SELECT\)/);
  assert.match(fireworkActions, /mapSavedFirework\(data as FireworkMutationRow\)/);
  assert.match(styleDefaultActions, /select\(STYLE_DEFAULT_MUTATION_SELECT\)/);
  assert.match(styleDefaultActions, /expectedUpdatedAt/);
  assert.match(
    styleDefaultActions,
    /archiveStyleDefault[\s\S]*?\.eq\('updated_at', parsed\.data\.expectedUpdatedAt\)/,
  );
  assert.match(
    styleDefaultEditor,
    /archiveStyleDefault\(\{[\s\S]*?id: styleDefault\.id,[\s\S]*?historyVersionId: mutation\.historyVersionId/,
  );
  assert.match(styleDefaultEditor, /archiveStartedClean/);
  assert.match(styleDefaultEditor, /styleDefaultSavedSnapshotFromFields\(result\.saved\)/);
  assert.match(styleDefaultEditor, /restoreStyleDefaultEditorVersion/);
  assert.match(styleDefaultEditor, /id: 'history'/);
  assert.match(styleDefaultEditor, /versions=\{editorHistory\.versions\}/);
  assert.doesNotMatch(historyPanel, />\s*Preview\s*</);
  assert.doesNotMatch(historyPanel, /onPreview|selectedVersionId/);
  assert.match(historyPanel, /pendingVersionIds\?: ReadonlySet<string>/);
  assert.match(historyPanel, /disabled=\{isPending \|\| mutationPending\}/);
  assert.match(historyPanel, /Recording version history\.\.\./);
  assert.match(historyPanel, /warning\?: string \| null/);
  assert.match(editorHistoryState, /latestTargetKeyRef\.current = targetKey/);
  assert.match(editorHistoryState, /if \(latestTargetKeyRef\.current !== targetKey\) return;/);
  assert.match(fireworkEditor, /function nextAddedColourStopIndex\(/);
  assert.match(
    fireworkEditor,
    /Math\.max\(\s*nextColourStopIdRef\.current,\s*nextAddedColourStopIndex\(snapshot\.colourStops\)/,
  );

  assert.match(effectServer, /type CachedAdminEffectDetail = Omit<AdminEffectDetail, 'history'>/);
  assert.match(effectServer, /history: await listEffectEditorVersions\(supabase, effectId\)/);
  assert.match(
    fireworkServer,
    /type CachedAdminFireworkDetail = Omit<AdminFireworkDetail, 'history'>/,
  );
  assert.match(fireworkServer, /history: await listFireworkEditorVersions\(supabase, fireworkId\)/);
  assert.match(
    styleDefaultServer,
    /history: await listStyleDefaultEditorVersions\(supabase, defaultId\)/,
  );
  assert.match(editorVersions, /function throwHistoryReadError\(/);
  assert.match(editorVersions, /throwHistoryReadError\('listFireworkEditorVersions', error\)/);
  assert.match(editorVersions, /throwHistoryReadError\('listEffectEditorVersions', error\)/);
  assert.match(editorVersions, /throwHistoryReadError\('listStyleDefaultEditorVersions', error\)/);

  assert.match(sliderField, /SliderPrimitive\.Thumb/);
  assert.match(sliderField, /SliderPrimitive\.Thumb\s*\n\s*id=\{sliderId\}/);
  assert.doesNotMatch(sliderField, /SliderPrimitive\.Root\s*\n\s*id=\{sliderId\}/);
  assert.match(sliderField, /aria-labelledby=\{labelId\}/);
});
