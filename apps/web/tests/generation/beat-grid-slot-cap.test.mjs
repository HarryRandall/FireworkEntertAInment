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

function buildMultiSectionAnalysis() {
  const duration = 240;
  const beatTimes = Array.from({ length: duration * 2 }, (_, index) => index * 0.5 + 0.25);
  const downbeatTimes = beatTimes.filter((_, index) => index % 4 === 0);
  const sections = [
    { start: 0, end: 18, label: 'intro', intensity: 'low', avg_energy: 0.4 },
    { start: 18, end: 42, label: 'verse', intensity: 'medium', avg_energy: 0.42 },
    { start: 42, end: 64, label: 'verse', intensity: 'medium', avg_energy: 0.46 },
    { start: 64, end: 86, label: 'pre-chorus', intensity: 'medium', avg_energy: 0.56 },
    { start: 86, end: 122, label: 'chorus', intensity: 'high', avg_energy: 0.8 },
    { start: 122, end: 170, label: 'verse', intensity: 'low', avg_energy: 0.3 },
    { start: 170, end: 198, label: 'bridge', intensity: 'medium', avg_energy: 0.48 },
    { start: 198, end: 224, label: 'chorus', intensity: 'high', avg_energy: 0.88 },
    { start: 224, end: duration, label: 'outro', intensity: 'low', avg_energy: 0.4 },
  ];

  return {
    duration,
    sections,
    analysis: {
      beat_times: beatTimes,
      downbeat_times: downbeatTimes,
      beats_per_bar: 4,
      tempo_bpm: 120,
      sections,
      onset_times: [],
      energy_timeline: [],
      buildups: [
        { start: 72, peak: 85.75 },
        { start: 186, peak: 197.75 },
      ],
      key_moments: [
        { time: 105.75, type: 'climax' },
        { time: 211.75, type: 'climax' },
      ],
      derived: { finale_window: { start: 198, end: duration } },
    },
  };
}

function groupSlotsByTime(slots) {
  const groups = new Map();
  for (const slot of slots) {
    const group = groups.get(slot.time) ?? [];
    group.push(slot);
    groups.set(slot.time, group);
  }
  return groups;
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

test('a capped realistic show retains every analysed section without accidental long gaps', async () => {
  const { buildCueSlots } = await loadBeatGrid();
  const { analysis, duration, sections } = buildMultiSectionAnalysis();

  const slots = buildCueSlots(analysis, duration, 3);
  const selectedTimes = [...groupSlotsByTime(slots).keys()].sort((a, b) => a - b);

  assert.ok(slots.length <= 220);
  assert.ok(
    slots.length >= 200,
    'the bounded grid should still use most of its choreography budget',
  );
  for (const section of sections) {
    const sectionTimes = selectedTimes.filter(
      (time) => time >= section.start && time < section.end,
    );
    assert.ok(
      sectionTimes.length >= 2,
      `${section.label} ${section.start}-${section.end}s lost meaningful slot coverage`,
    );
  }

  const gaps = selectedTimes.slice(1).map((time, index) => time - selectedTimes[index]);
  assert.ok(Math.max(...gaps) <= 6, `capping left a ${Math.max(...gaps)}s gap in a live section`);
});

test('realistic capped choreography keeps simultaneous launch-position groups atomic', async () => {
  const { buildCueSlots } = await loadBeatGrid();
  const { analysis, duration } = buildMultiSectionAnalysis();

  const slots = buildCueSlots(analysis, duration, 3);
  const groups = groupSlotsByTime(slots);

  for (const [time, group] of groups) {
    const beat = group[0];
    const expectedTubes =
      beat.emphasis === 'peak' ||
      beat.intensity >= 0.62 ||
      beat.nearClimax ||
      beat.vibe === 'chorus' ||
      beat.vibe === 'drop'
        ? 3
        : beat.intensity >= 0.4 || beat.vibe === 'pre-chorus' || beat.vibe === 'buildup'
          ? 2
          : 1;
    assert.equal(group.length, expectedTubes, `the ${time}s firing group was partially capped`);
    assert.equal(new Set(group.map((slot) => slot.tube)).size, expectedTubes);
  }

  assert.ok(slots.some((slot) => slot.nearClimax && Math.abs(slot.time - 105.75) < 1.5));
  assert.ok(slots.some((slot) => slot.nearClimax && Math.abs(slot.time - 211.75) < 1.5));
});

test('the final analysed beat survives capping as a full peak group', async () => {
  const { buildCueSlots } = await loadBeatGrid();
  const { analysis, duration } = buildMultiSectionAnalysis();
  analysis.sections.at(-1).avg_energy = 0;

  const slots = buildCueSlots(analysis, duration, 3);
  const finalBeatTime = analysis.beat_times.at(-1);
  const finalGroup = groupSlotsByTime(slots).get(finalBeatTime);

  assert.equal(finalBeatTime, duration - 0.25);
  assert.equal(finalGroup?.length, 3);
  assert.ok(finalGroup?.every((slot) => slot.emphasis === 'peak'));
});
