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
  // The time button still seeks paused, but now stops propagation so the row's
  // play-from-here handler does not also fire.
  assert.match(
    cueTable,
    /onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*setIsPlaying\(false\);\s*seekTo\(cue\.timeSeconds, false\);/,
  );
  assert.match(cueTable, /focus-visible:ring-3/);
  // Selecting a row plays the show live from that cue (same as the menu action).
  assert.match(cueTable, /onClick=\{\(\) => playFrom\(cue\.timeSeconds\)\}/);
  assert.match(cueTable, /title="Play from here"/);
  assert.match(cueTable, /cursor-pointer/);
  // The actions cell stops propagation so opening the menu never plays the row.
  assert.match(cueTable, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
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
  assert.match(viewer, /setCueToDelete\(null\);/);
  assert.match(viewer, /applyOptimisticCue\(\{ type: 'remove', cueId: target\.cueId \}\);/);
  assert.match(
    viewer,
    /applyOptimisticCue\(\{ type: 'remove'[\s\S]*await deletePreviewCueAction\(formData\)/,
  );
  assert.match(viewer, /current\.filter\(\(cue\) => cue\.id !== action\.cueId\)/);
  assert.match(viewer, /toast\.error\(result\.error, \{ id: deletionToastId \}\)/);
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
