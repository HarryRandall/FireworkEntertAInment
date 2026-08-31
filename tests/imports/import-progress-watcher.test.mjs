/** Static guards for bounded, accessible import status polling. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const source = readFileSync(
  join(root, 'app/(admin)/admin/imports/[id]/ImportProgressWatcher.tsx'),
  'utf8',
);

test('import polling stops at terminal states and pauses in hidden tabs', () => {
  assert.match(source, /setStatus\(initialStatus\)/);
  assert.match(source, /setStage\(initialStage\)/);
  assert.match(source, /setProgress\(initialProgress\)/);
  assert.match(source, /if \(TERMINAL_STATUSES\.has\(initialStatus\)\) return/);
  assert.match(source, /TERMINAL_STATUSES\.has\(currentStatus\)/);
  assert.match(source, /document\.visibilityState === 'hidden'/);
  assert.match(source, /addEventListener\('visibilitychange'/);
  assert.match(source, /removeEventListener\('visibilitychange'/);
  assert.doesNotMatch(source, /activeIntervalMs \* 6/);
});

test('import progress exposes live status and progressbar semantics', () => {
  const connectionIssue = source.slice(
    source.indexOf('{connectionIssue ?'),
    source.indexOf('{errorMessage ?'),
  );
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /aria-valuenow=/);
  assert.match(connectionIssue, /role="status"/);
  assert.match(connectionIssue, /temporarily unavailable/);
  assert.match(source, /role="alert"/);
});
