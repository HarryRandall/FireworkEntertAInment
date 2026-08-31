/** Source guards for bounded, truth-preserving workspace summary reads. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  clearCachedAiUsage,
  isWorkspaceSummaryFresh,
  readCachedWorkspaceSummary,
  writeCachedWorkspaceSummary,
} from '../../components/shell/workspace-summary-cache.client.ts';

const root = process.cwd();
const summary = readFileSync(join(root, 'lib/show-summary.server.ts'), 'utf8');
const shell = readFileSync(join(root, 'components/shell/AppShell.tsx'), 'utf8');
const cache = readFileSync(
  join(root, 'components/shell/workspace-summary-cache.client.ts'),
  'utf8',
);

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
  assert.match(cache, /CACHE_KEY_PREFIX = 'sc:workspace-summary:v3'/);
  assert.match(cache, /CACHE_TTL_MS = 60_000/);
  assert.match(cache, /export function isWorkspaceSummaryFresh/);
  assert.match(shell, /if \(isWorkspaceSummaryFresh\(cached\)\) \{/);
  assert.match(shell, /cachedAt: Date\.now\(\)/);
  assert.match(cache, /aiUsage: null, cachedAt: 0/);

  const freshnessCheck = shell.indexOf('if (isWorkspaceSummaryFresh(cached))');
  const request = shell.indexOf("fetch('/api/me/summary'");
  assert.ok(freshnessCheck >= 0 && request > freshnessCheck);
});

test('workspace summary cache is profile-scoped and fails closed', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const entries = new Map();
  const sessionStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage },
  });

  try {
    const cached = {
      showCount: 2,
      recentShows: [],
      aiUsage: { balance: 10 },
      cachedAt: Date.now(),
    };

    writeCachedWorkspaceSummary('profile-one', cached);
    assert.deepEqual(readCachedWorkspaceSummary('profile-one'), cached);
    assert.equal(readCachedWorkspaceSummary('profile-two'), null);
    assert.equal(isWorkspaceSummaryFresh(cached), true);
    assert.equal(isWorkspaceSummaryFresh({ ...cached, cachedAt: Date.now() - 60_001 }), false);

    clearCachedAiUsage('profile-one');
    assert.deepEqual(readCachedWorkspaceSummary('profile-one'), {
      ...cached,
      aiUsage: null,
      cachedAt: 0,
    });

    entries.set('sc:workspace-summary:v3:profile-one', '{invalid');
    assert.equal(readCachedWorkspaceSummary('profile-one'), null);

    writeCachedWorkspaceSummary('profile-one', null);
    assert.equal(entries.size, 0);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
