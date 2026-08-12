import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { buildBeatMoments } from '../lib/cue-generation/beat-sync-moments.ts';
import { parseAnalyserResult } from '../lib/show-analysis-validation.ts';
import { makeAnalysisFixture } from './helpers/music-analysis-fixture.mjs';

const root = process.cwd();
const profiles = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/music-analysis-profiles.json'), 'utf8'),
);

async function loadBeatGrid() {
  const source = readFileSync(join(root, 'lib/beat-grid.server.ts'), 'utf8').replace(
    "import 'server-only';",
    '',
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const direction = {
  style: 'beat_test',
  density: 'balanced',
  precise: true,
  surprise: false,
  quietMiddle: false,
  softEnding: false,
  bigEnding: true,
};

test('validated analysis profiles produce section-aware beat moments', async () => {
  const { buildCueSlots } = await loadBeatGrid();

  for (const profile of profiles) {
    const analysis = parseAnalyserResult(makeAnalysisFixture(profile));
    const slots = buildCueSlots(analysis, analysis.duration_seconds, 3);
    const moments = buildBeatMoments({ slots, songDuration: analysis.duration_seconds, direction });

    assert.ok(slots.length > 0, `${profile.name} should produce cue slots`);
    assert.ok(moments.length > 0, `${profile.name} should produce planned moments`);
    assert.ok(
      moments.some((moment) => moment.finale),
      `${profile.name} should preserve its analysed finale`,
    );
    assert.ok(
      moments.some((moment) => moment.sectionLabel === profile.sections.at(-1).label),
      `${profile.name} should carry section identity into planning`,
    );
  }
});
