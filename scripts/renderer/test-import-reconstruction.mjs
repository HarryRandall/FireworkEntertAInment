/** Real worker candidates must parse in the app and replay with the show renderer. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  IMPORT_RECONSTRUCTION_VALIDATOR_VERSION,
  parseImportCandidateMetrics,
  parseImportReconstruction,
  reconstructionToReplayCues,
} from '../../apps/web/lib/firework-import/reconstruction.ts';
import { buildShowRendererShots } from '../../apps/web/lib/shows/renderer-shots.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const localPython = `${root}services/firework-import-worker/.venv/bin/python`;
const python = process.env.PYTHON ?? (existsSync(localPython) ? localPython : 'python');
const result = spawnSync(
  python,
  ['services/firework-import-worker/tests/reconstruction_contract_case.py'],
  { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 },
);
assert.equal(result.status, 0, result.error?.message ?? result.stderr);
const rows = JSON.parse(result.stdout);
assert.ok(rows.length >= 1);
assert.equal(rows[0].metrics.source, 'fitted');
for (const row of rows) {
  assert.equal(row.schemaVersion, IMPORT_RECONSTRUCTION_VALIDATOR_VERSION);
  assert.equal(row.validation.validatorVersion, IMPORT_RECONSTRUCTION_VALIDATOR_VERSION);
  const parsed = parseImportReconstruction(row.reconstruction);
  assert.equal(parsed.success, true, JSON.stringify(parsed.issues));
  const metrics = parseImportCandidateMetrics(row.metrics);
  assert.ok(metrics, 'fit evidence must match the app schema');
  assert.equal(metrics.fit.shots.length, parsed.data.shots.length);
  const shots = buildShowRendererShots(reconstructionToReplayCues(parsed.data), [], false);
  assert.equal(shots.ok, true, shots.error);
  assert.equal(shots.shots.length, parsed.data.shots.length);
}
console.log(`${rows.length} worker candidates match the app contract and replay.`);
