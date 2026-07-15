/** Static guards for keyboard seeking and confirmed cue deletion. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const viewer = readFileSync(join(root, 'app/components/app/FireworkReplayViewer.tsx'), 'utf8');

test('cue rows expose a labelled keyboard-operable seek action', () => {
  const cueTable = viewer.slice(
    viewer.indexOf('{visibleBuilderCues.map'),
    viewer.indexOf('</tbody>'),
  );

  assert.match(cueTable, /<button\s+type="button"/);
  assert.match(cueTable, /aria-label=\{`Seek to \$\{fireworkName\} at \$\{cueTimeLabel\}`\}/);
  assert.match(cueTable, /aria-current=\{isActive \? 'true' : undefined\}/);
  assert.match(
    cueTable,
    /onClick=\{\(\) => \{\s*setIsPlaying\(false\);\s*seekTo\(cue\.timeSeconds, false\);/,
  );
  assert.match(cueTable, /focus-visible:ring-3/);
  assert.doesNotMatch(cueTable, /<tr[^>]*onClick=/);
  assert.doesNotMatch(cueTable, /cursor-pointer/);
  assert.match(cueTable, /isActive &&\s*'bg-\[color:var\(--color-bg-muted\)\]/);
});

test('cue deletion requires cue-specific confirmation and locks repeat submissions', () => {
  assert.match(
    viewer,
    /type CueDeletionTarget = \{[\s\S]*cueId: string;[\s\S]*fireworkName: string;[\s\S]*timeLabel: string;/,
  );
  assert.match(viewer, /const deletingCueIdRef = useRef<string \| null>\(null\);/);
  assert.match(viewer, /if \(!target \|\| deletingCueIdRef\.current !== null\) return;/);
  assert.match(viewer, /deletingCueIdRef\.current = target\.cueId;/);
  assert.match(viewer, /<AlertDialogTitle>Delete this cue\?<\/AlertDialogTitle>/);
  assert.match(viewer, /<strong>\{cueToDelete\.fireworkName\}<\/strong> at/);
  assert.match(viewer, /\{cueToDelete\.timeLabel\}/);
  assert.match(viewer, /disabled=\{deletingCueId !== null\}/);
  assert.match(viewer, /aria-busy=\{deletingCueId !== null\}/);
  assert.match(viewer, /<span aria-live="polite">/);
  assert.match(viewer, /event\.preventDefault\(\);\s*deleteCue\(\);/);
  assert.match(viewer, /deletingCueIdRef\.current = null;\s*setDeletingCueId\(null\);/);
  assert.match(viewer, /onSelect: \(\) =>\s*requestCueDeletion\(\{/);
  assert.doesNotMatch(viewer, /onSelect: \(\) => deleteCue\(baseCueId\)/);
});
