/** Static guards for copy-on-apply firework style defaults. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readDollarQuotedJson(source, tag) {
  const marker = `$${tag}$`;
  const start = source.indexOf(marker);
  const end = source.indexOf(marker, start + marker.length);
  assert.notEqual(start, -1, `${marker} opening marker not found`);
  assert.notEqual(end, -1, `${marker} closing marker not found`);
  return JSON.parse(source.slice(start + marker.length, end));
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} not found`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(brace + 1, index);
  }
  throw new Error(`${name} body was not closed`);
}

test('style default schema keeps saved defaults and prunes live links', () => {
  const types = read('lib/database.types.ts');
  assert.doesNotMatch(types, /firework_effect_style_default_links: \{/);
  assert.doesNotMatch(types, /firework_style_default_links: \{/);
  assert.doesNotMatch(types, /star_style_default_id:/);
  assert.doesNotMatch(types, /trail_style_default_id:/);
});

test('admin actions save copied default settings without live assignments', () => {
  const styleActions = read('app/(admin)/admin/effects/style-default-actions.ts');
  const effectActions = read('app/(admin)/admin/effects/actions.ts');
  const fireworkActions = read('app/(admin)/admin/fireworks/actions.ts');
  const effectEditor = read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx');

  assert.match(styleActions, /z\.enum\(FIREWORK_STYLE_DEFAULT_KINDS\)/);
  assert.match(styleActions, /styleDefault: AdminStyleDefaultOption/);
  assert.match(styleActions, /styleDefault: \{/);
  assert.match(styleActions, /INITIAL_STYLE_DEFAULT_JSON\[parsedKind\]/);
  assert.match(styleActions, /styleDefaultKindLabel\(parsedKind\)\.toLowerCase\(\)/);
  assert.match(styleActions, /is_archived: true/);
  assert.match(styleActions, /invalidateAdminStyleDefaultsCache\(defaultId\)/);

  assert.match(effectActions, /StyleDefaultAssignmentsSchema/);
  assert.doesNotMatch(effectActions, /normaliseStyleDefaultAssignments/);
  assert.doesNotMatch(effectActions, /replaceEffectStyleDefaultLinks/);
  assert.doesNotMatch(effectActions, /star_style_default_id|trail_style_default_id/);
  assert.match(effectActions, /styleDefaultIds: emptyStyleDefaultIdMap\(\)/);

  assert.match(fireworkActions, /StyleDefaultAssignmentsSchema/);
  assert.doesNotMatch(fireworkActions, /replaceFireworkStyleDefaultLinks/);
  assert.doesNotMatch(fireworkActions, /star_style_default_id|trail_style_default_id/);
  assert.match(fireworkActions, /styleDefaultIds: emptyStyleDefaultIdMap\(\)/);

  assert.match(effectEditor, /function copySelectedStyleDefaultsIntoModel/);
  assert.match(effectEditor, /applySnapshot\(savedSnapshot\)/);
  assert.match(fireworkEditor, /function copySelectedStyleDefaultsIntoOverrides/);
  assert.match(fireworkEditor, /applySnapshot\(savedSnapshot\)/);
});

test('style default saves, archives, and restores record live editor history', () => {
  const types = read('lib/database.types.ts');
  const adminTypes = read('lib/admin.types.ts');
  const snapshots = read('lib/admin/editor-snapshots.ts');
  const actions = read('app/(admin)/admin/effects/style-default-actions.ts');
  const loader = read('lib/admin/style-defaults.server.ts');
  const versions = read('lib/admin/editor-versions.server.ts');
  const editor = read('app/(admin)/admin/effects/defaults/[id]/_components/StyleDefaultEditor.tsx');
  assert.match(types, /firework_style_default_id: string \| null/);
  assert.match(types, /foreignKeyName: "firework_editor_versions_firework_style_default_id_fkey"/);
  assert.match(
    adminTypes,
    /AdminEditorVersionTargetKind = 'firework' \| 'effect' \| 'style_default'/,
  );
  assert.match(adminTypes, /AdminStyleDefaultDetail = AdminStyleDefaultSummary & \{/);
  assert.match(adminTypes, /history: AdminEditorVersion\[\]/);
  assert.match(snapshots, /export type StyleDefaultEditorSnapshot/);
  assert.match(snapshots, /export function makeStyleDefaultEditorSnapshot/);
  assert.match(snapshots, /export function parseStyleDefaultEditorSnapshot/);

  assert.match(loader, /listStyleDefaultEditorVersions/);
  assert.match(loader, /history: await listStyleDefaultEditorVersions\(supabase, defaultId\)/);
  assert.match(versions, /export async function listStyleDefaultEditorVersions/);
  assert.match(versions, /\.eq\('firework_style_default_id', styleDefaultId\)/);
  assert.match(versions, /throwHistoryReadError\('listStyleDefaultEditorVersions', error\)/);

  for (const name of [
    'updateStyleDefault',
    'archiveStyleDefault',
    'restoreStyleDefaultEditorVersion',
  ]) {
    const body = functionBody(actions, name);
    assert.match(body, /historyVersionId: parsed\.data\.historyVersionId/);
    assert.match(body, /const historyRecorded = await recordStyleDefaultVersion/);
    assert.match(body, /return \{ ok: true,[\s\S]*historyVersion, historyRecorded \}/);
    assert.ok(
      body.indexOf('await recordStyleDefaultVersion') < body.indexOf('await refresh'),
      `${name} must observe history before invalidating caches`,
    );
  }
  const restoreBody = functionBody(actions, 'restoreStyleDefaultEditorVersion');
  assert.match(restoreBody, /parseStyleDefaultEditorSnapshot/);
  assert.match(restoreBody, /action: 'restore'/);
  assert.match(restoreBody, /Restored version from/);

  assert.match(editor, /restoreStyleDefaultEditorVersion/);
  assert.match(editor, /parseStyleDefaultEditorSnapshot/);
  assert.match(editor, /id: 'history'/);
  assert.match(editor, /label: 'History'/);
  assert.match(editor, /<EditorHistoryPanel/);
  assert.match(editor, /versions=\{editorHistory\.versions\}/);
  assert.match(editor, /pendingVersionIds=\{editorHistory\.pendingIds\}/);
  assert.match(editor, /onRestore=\{restoreVersion\}/);
  assert.doesNotMatch(editor, /router\.refresh\(\)/);
});

test('inline style-default creation and parent editor saves are atomic', () => {
  const effectActions = read('app/(admin)/admin/effects/actions.ts');
  const fireworkActions = read('app/(admin)/admin/fireworks/actions.ts');
  const effectEditor = read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx');

  assert.match(effectActions, /export async function createStyleDefaultAndUpdateEffect/);
  assert.match(effectActions, /rpc\('create_style_default_and_update_effect'/);
  assert.match(fireworkActions, /export async function createStyleDefaultAndUpdateFirework/);
  assert.match(fireworkActions, /rpc\('create_style_default_and_update_firework'/);
  assert.match(effectEditor, /createStyleDefaultAndUpdateEffect\(\{/);
  assert.match(fireworkEditor, /createStyleDefaultAndUpdateFirework\(\{/);
  assert.doesNotMatch(effectEditor, /await createStyleDefault\(\{/);
  assert.doesNotMatch(fireworkEditor, /await createStyleDefault\(\{/);
});

test('style default writes reject invalid renderer fragments', () => {
  const actions = read('app/(admin)/admin/effects/style-default-actions.ts');

  assert.match(actions, /fireworkDesignFragmentError\(parsed\)/);
  assert.match(actions, /fireworkDesignFragmentError\(snapshot\.defaultsJson\)/);
});
