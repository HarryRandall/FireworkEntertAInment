/** Whole-sequence audit exercises live frame construction at close and far camera distances. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('camera distance preserves every frame count and warm playback retains storage', () => {
  const root = new URL('../../../', import.meta.url);
  const output = execFileSync(
    process.execPath,
    [
      '--import',
      './scripts/register-typescript.mjs',
      'packages/fireworks/scripts/profile-zoom.mjs',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  const rows = output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(rows.length, 8);
  assert.deepEqual(new Set(rows.map((row) => row.mode)), new Set(['audience', 'free']));
  const audienceFar = rows.find((row) => row.mode === 'audience' && row.zoom > 1);
  const freeFar = rows.find((row) => row.mode === 'free' && row.zoom > 1);
  assert.ok(freeFar.distance_m > audienceFar.distance_m * 2);
  assert.ok(rows.every((row) => row.cameraPosition[1] >= 1.7 - 1e-9));
  assert.ok(rows.every((row) => row.frames > 1000));
  assert.equal(new Set(rows.map((row) => row.countDigest)).size, 1);
  for (const row of rows) {
    assert.equal(row.candidateBufferBytes, 0, 'procedural vertices need no candidate buffer');
    if (row.run === 'warm') assert.equal(row.replacements, 0);
  }
});
