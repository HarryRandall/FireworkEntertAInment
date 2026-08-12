import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRetryableAnalyserStatus } from '../lib/analyser-http-status.ts';

test('analyser HTTP retry classification distinguishes transient and terminal failures', () => {
  for (const status of [408, 425, 429, 500, 502, 503]) {
    assert.equal(isRetryableAnalyserStatus(status), true, `${status} should retry`);
  }
  for (const status of [400, 401, 403, 404, 409, 413, 422]) {
    assert.equal(isRetryableAnalyserStatus(status), false, `${status} should be terminal`);
  }
});
