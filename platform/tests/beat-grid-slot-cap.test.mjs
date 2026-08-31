import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const root = process.cwd();

async function loadBeatGrid() {
  const source = readFileSync(join(root, 'lib/beat-grid.server.ts'), 'utf8').replace(
    "import 'server-only';",
    '',
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

test('the slot cap keeps complete priority groups in chronological order', async () => {
  const { buildCueSlots } = await loadBeatGrid();
  const beatTimes = Array.from({ length: 80 }, (_, index) => index + 0.5);
  const analysis = {
    beat_times: beatTimes,
    downbeat_times: [79.5],
    beats_per_bar: 4,
    tempo_bpm: 60,
    sections: [
      {
        start: 0,
        end: 80,
        label: 'chorus',
        intensity: 'high',
        avg_energy: 0.8,
      },
    ],
    buildups: [{ start: 74, peak: 75.5 }],
    key_moments: [{ time: 74.5, type: 'climax' }],
    derived: { finale_window: { start: 65, end: 70 } },
  };

  const slots = buildCueSlots(analysis, 80, 3);
  const groups = new Map();
  for (const slot of slots) {
    const group = groups.get(slot.time) ?? [];
    group.push(slot);
    groups.set(slot.time, group);
  }

  assert.equal(slots.length, 219);
  assert.ok(slots.length <= 220);
  assert.deepEqual(
    slots.map((slot) => slot.index),
    Array.from({ length: slots.length }, (_, index) => index),
  );
  assert.ok(slots.every((slot, index) => index === 0 || slot.time >= slots[index - 1].time));
  assert.ok([...groups.values()].every((group) => group.length === 3));

  for (const priorityTime of [65.5, 69.5, 74.5, 75.5, 79.5]) {
    assert.equal(groups.get(priorityTime)?.length, 3);
  }
});
