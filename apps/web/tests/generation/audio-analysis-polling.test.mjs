/** Static guards for scoped, bounded song-analysis polling. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const timeline = readFileSync(join(root, 'components/shows/AudioAnalysisTimeline.tsx'), 'utf8');
const route = readFileSync(join(root, 'app/api/shows/[id]/analysis/route.ts'), 'utf8');

test('song analysis polls a scoped endpoint without refreshing the route', () => {
  assert.match(timeline, /fetch\(`\/api\/shows\/\$\{encodeURIComponent\(showId\)\}\/analysis`/);
  assert.match(timeline, /setPollState\(\{ source: initialAnalysis, value: nextAnalysis \}\)/);
  assert.doesNotMatch(timeline, /useRouter/);
  assert.doesNotMatch(timeline, /router\.refresh/);
  assert.doesNotMatch(timeline, /setInterval/);
});

test('song analysis polling stops at terminal states and pauses in hidden tabs', () => {
  assert.match(timeline, /analysis\?\.status === 'running'/);
  assert.match(timeline, /analysisIsRunning = nextAnalysis\.status === 'running'/);
  assert.match(timeline, /document\.visibilityState === 'hidden'/);
  assert.match(timeline, /requestController\?\.abort\(\)/);
  assert.match(timeline, /addEventListener\('visibilitychange'/);
  assert.match(timeline, /removeEventListener\('visibilitychange'/);
});

test('song analysis status changes are exposed to assistive technology', () => {
  assert.match(timeline, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(timeline, /aria-busy=\{analysis\?\.status === 'running'\}/);
  assert.match(timeline, /Song analysis completed\./);
  assert.match(timeline, /Song analysis failed\./);
});

test('analysis status reads are authenticated, owner-scoped, and uncached', () => {
  assert.match(route, /getCurrentUserId\(\)/);
  assert.match(route, /getLatestAnalysisForShow\(parsedShowId\.data\)/);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 500/);
});
