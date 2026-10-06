/** SQL regression gates must propagate TAP failures despite successful psql exit codes. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSqlTestOutput } from './runtime.mjs';

test('pgTAP assertion and plan failures fail the database test gate', () => {
  assert.doesNotThrow(() => assertSqlTestOutput(' ok 1 - valid design\n 1..1\n'));
  assert.doesNotThrow(() => assertSqlTestOutput('BEGIN\nDO\nROLLBACK\n'));
  assert.throws(() => assertSqlTestOutput(' not ok 1 - invalid design accepted\n'), /not ok 1/);
  assert.throws(
    () => assertSqlTestOutput(' # Looks like you planned 2 tests but ran 1\n'),
    /planned/,
  );
  assert.throws(() => assertSqlTestOutput(' # Looks like you failed 1 test of 2\n'), /failed/);
});
