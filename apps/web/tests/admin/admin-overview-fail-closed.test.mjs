/** Source guards for truthful admin overview metrics. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readFileSync(join(process.cwd(), 'lib/admin/overview.server.ts'), 'utf8');

test('admin overview rejects any failed metric read before building or caching totals', () => {
  const errorCheck = source.indexOf('throwOverviewReadErrors([');
  const metricBuild = source.indexOf('const metrics: AdminOverviewMetrics');
  const cacheWrite = source.indexOf('await setCachedJson(cacheKey, metrics');

  assert.ok(errorCheck >= 0, 'metric query errors are checked');
  assert.ok(metricBuild > errorCheck, 'metrics are built only after all reads succeed');
  assert.ok(cacheWrite > metricBuild, 'only complete metrics reach the cache');

  for (const result of [
    'currentShowsResult',
    'previousShowsResult',
    'recentShowsResult',
    'currentShowCuesResult',
    'previousShowCuesResult',
    'recentShowCuesResult',
    'currentMusicAnalysesResult',
    'previousMusicAnalysesResult',
    'recentMusicAnalysesResult',
  ]) {
    assert.match(source.slice(errorCheck, metricBuild), new RegExp(`${result}\\.error`));
  }

  assert.match(source, /throw new Error\('Admin overview metrics could not be loaded\.'/);
  assert.doesNotMatch(source, /function logOverviewError/);
});
