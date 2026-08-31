import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync('../.github/workflows/ci.yml', 'utf8');
const pythonContract = readFileSync('analyser/tests/test_schema_validation.py', 'utf8');

test('cross-language analyser contract has a hermetic fail-closed CI job', () => {
  const contractJob = workflow.slice(workflow.indexOf('  analyser-contract:'));

  assert.match(contractJob, /working-directory: platform/);
  assert.match(contractJob, /uses: actions\/setup-node@v7/);
  assert.match(contractJob, /node-version: 22/);
  assert.match(contractJob, /cache-dependency-path: platform\/package-lock\.json/);
  assert.match(contractJob, /run: npm ci/);
  assert.match(contractJob, /uses: actions\/setup-python@v7/);
  assert.match(contractJob, /python-version: "3\.11\.15"/);
  assert.match(contractJob, /python -m pip install -r analyser\/requirements\.txt/);
  assert.match(contractJob, /SHOWCRAFTER_RUN_CROSS_LANGUAGE_CONTRACT: "1"/);
  assert.match(
    contractJob,
    /SchemaValidationTests\.test_actual_python_json_passes_zod_and_builds_cue_slots/,
  );
  assert.match(pythonContract, /SHOWCRAFTER_RUN_CROSS_LANGUAGE_CONTRACT/);
  assert.match(
    pythonContract,
    /self\.fail\("The analyser contract requires Node\.js 22 or newer"\)/,
  );
  assert.match(pythonContract, /self\.assertGreaterEqual\(major_version, 22\)/);
});
