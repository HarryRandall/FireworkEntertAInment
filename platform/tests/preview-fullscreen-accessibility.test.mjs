/** Static guards for the shared fullscreen modal and its clean preview consumers. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('fullscreen helper keeps legacy callers while offering a labelled modal contract', () => {
  const helper = read('app/components/admin/previewFullscreen.tsx');

  assert.match(helper, /PreviewFullscreenOptions = \{/);
  assert.match(helper, /dialogLabel\?: string/);
  assert.match(helper, /dialogLabelledBy\?: string/);
  assert.match(helper, /PreviewFullscreenOptions = \{\}/);
  assert.match(helper, /fullscreenContainerRef/);
  assert.match(helper, /fullscreenContainerProps/);
  assert.match(helper, /role: 'dialog'/);
  assert.match(helper, /'aria-modal': true/);
  assert.match(helper, /'aria-labelledby': dialogLabelledBy/);
  assert.match(helper, /'aria-label': dialogLabel/);
  assert.match(helper, /tabIndex: -1/);
});

test('fullscreen helper traps and restores focus while isolating background branches', () => {
  const helper = read('app/components/admin/previewFullscreen.tsx');

  assert.match(helper, /document\.activeElement instanceof HTMLElement/);
  assert.match(helper, /container\.focus\(\{ preventScroll: true \}\)/);
  assert.match(helper, /event\.key !== 'Tab'/);
  assert.match(helper, /event\.shiftKey \? last : first/);
  assert.match(helper, /opener\?\.isConnected/);
  assert.match(helper, /opener\.focus\(\{ preventScroll: true \}\)/);
  assert.match(helper, /sibling\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(helper, /sibling\.setAttribute\('inert', ''\)/);
  assert.match(helper, /branch\.element\.removeAttribute\('aria-hidden'\)/);
  assert.match(helper, /branch\.element\.removeAttribute\('inert'\)/);
  assert.match(helper, /data-preview-fullscreen-layer/);
});

test('fullscreen helper retains Escape, scroll lock and backdrop exit', () => {
  const helper = read('app/components/admin/previewFullscreen.tsx');

  assert.match(helper, /event\.key === 'Escape'/);
  assert.match(helper, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(helper, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(helper, /onClick=\{onExit\}/);
});

test('clean replay consumers opt into the shared fullscreen dialog contract', () => {
  const consumers = [
    'app/components/app/FireworkReplayViewer.tsx',
    'app/components/app/TemplateReplayPreview.tsx',
    'app/(admin)/admin/imports/[id]/FireworkImportPreview.tsx',
    'app/(admin)/admin/show-presets/[id]/ShowPresetEditor.tsx',
    'app/(admin)/admin/multishots/[id]/MultishotEditor.tsx',
  ];

  for (const path of consumers) {
    const source = read(path);
    assert.match(source, /usePreviewFullscreen(?:<HTMLElement>)?\(\{ dialogLabel:/, path);
    assert.match(source, /fullscreenContainerRef/, path);
    assert.match(source, /fullscreenContainerProps/, path);
    assert.match(source, /ref=\{fullscreenContainerRef|fullscreenContainerRef: containerRef/, path);
    assert.match(source, /\{\.\.\.fullscreenContainerProps\}/, path);
  }
});
