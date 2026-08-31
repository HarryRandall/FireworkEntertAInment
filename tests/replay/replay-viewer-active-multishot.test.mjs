/** Static guard for keeping multi-shot rows active while their shots play. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const viewer = readFileSync(join(root, 'components/replay/FireworkReplayViewer.tsx'), 'utf8');

test('multi-shot builder rows stay active for their whole playback window', () => {
  assert.match(viewer, /endTimeSeconds/);
  assert.match(viewer, /cue\.timeSeconds \+ Math\.max\(cue\.firework\.durationSeconds/);
  assert.match(viewer, /const activeBaseCueIds = useMemo/);
  assert.match(viewer, /row\.shotCount <= 1/);
  assert.match(viewer, /elapsed <= row\.endTimeSeconds \+ 0\.35/);
  assert.match(viewer, /activeBaseCueIds\.has\(baseCueId\)/);
});
