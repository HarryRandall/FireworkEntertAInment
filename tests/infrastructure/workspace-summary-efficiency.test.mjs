/** Source guards for bounded, truth-preserving workspace summary reads. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const summary = readFileSync(join(root, 'lib/show-summary.server.ts'), 'utf8');
const shell = readFileSync(join(root, 'components/shell/AppShell.tsx'), 'utf8');

test('workspace summary skips template reads and limits detailed show rows', () => {
  const start = summary.indexOf('export async function getWorkspaceSummary');
  const body = summary.slice(start);

  assert.match(
    body,
    /select\('duration_seconds, total_cents, budget_cents', \{ count: 'exact' \}\)/,
  );
  assert.match(body, /select\(SHOW_SELECT\)/);
  assert.match(body, /\.limit\(3\)/);
  assert.match(body, /totalsResult\.error \?\? recentResult\.error/);
  assert.match(body, /if \(totalsResult\.count === null\)/);
  assert.doesNotMatch(body, /getDashboardSummary\(/);
  assert.doesNotMatch(body, /listShowTemplates\(/);
});

test('workspace summary navigation refreshes are bounded by a short profile cache', () => {
  assert.match(shell, /WORKSPACE_SUMMARY_CACHE_KEY_PREFIX = 'sc:workspace-summary:v3'/);
  assert.match(shell, /WORKSPACE_SUMMARY_CACHE_TTL_MS = 60_000/);
  assert.match(shell, /function isWorkspaceSummaryFresh/);
  assert.match(shell, /if \(isWorkspaceSummaryFresh\(cached\)\) \{/);
  assert.match(shell, /cachedAt: Date\.now\(\)/);
  assert.match(shell, /aiUsage: null, cachedAt: 0/);

  const freshnessCheck = shell.indexOf('if (isWorkspaceSummaryFresh(cached))');
  const request = shell.indexOf("fetch('/api/me/summary'");
  assert.ok(freshnessCheck >= 0 && request > freshnessCheck);
});
