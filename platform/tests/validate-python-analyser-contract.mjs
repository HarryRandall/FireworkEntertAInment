import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAnalyserResult } from '../lib/show-analysis-validation.ts';

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('Pass the Python analyser fixture path.');

const parsed = parseAnalyserResult(JSON.parse(readFileSync(fixturePath, 'utf8')));
assert.equal(parsed.schema_version, '1.4.0');
assert.equal(parsed.total_beats, parsed.beat_times.length);
process.stdout.write(`Validated Python analyser schema ${parsed.schema_version}.\n`);
