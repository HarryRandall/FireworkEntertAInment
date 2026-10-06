import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { readCsv, writeCsv } from '../../lib/finale/csv.ts';
import {
  exportCakeInventory as inventoryResult,
  exportCakeScript as scriptResult,
} from '../../lib/finale/export.ts';
import {
  previewCakeImport,
  importedCakeDocument as documentResult,
} from '../../lib/finale/import.ts';
import { exportShowScript, finaleTime } from '../../lib/finale/script.ts';
function unwrap(result, key) {
  assert.notEqual(result.kind, 'error', result.message);
  return result[key];
}
const exportCakeInventory = (...args) => unwrap(inventoryResult(...args), 'csv');
const exportCakeScript = (...args) => unwrap(scriptResult(...args), 'csv');
const importedCakeDocument = (...args) => unwrap(documentResult(...args), 'document');
const effects = ['Red Peony', 'Green Peony'].map((name, index) => ({
  id: `40000000-0000-4000-8000-00000000000${index + 1}`,
  name,
  document: { kind: 'shell', breaks: [{}] },
}));
const metadata = { partNumber: 'SC-CAKE-021', calibreMm: 30 };
const current = {
  composition: { tubes: [], box: { rows: 3, cols: 7, pitch_mm: 40 }, fuse_delay_ms: 3000 },
  bindings: {},
};
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const exact = (text) => {
  const preview = previewCakeImport(text, effects);
  assert.equal(preview.kind, 'preview', preview.message);
  return preview;
};
test('sample inventory and script cake rows reconstruct identical carry-over timings and angles', () => {
  const inventory = readCsv(fixture('finale-effects-sample.csv'));
  const cake = writeCsv([inventory[0], inventory[1]]);
  const inventoryPreview = exact(cake);
  const scriptPreview = exact(fixture('finale-cake-sample.csv'));
  assert.deepEqual(scriptPreview, inventoryPreview);
  assert.equal(inventoryPreview.tubes.length, 21);
  assert.equal(inventoryPreview.tubes.at(-1).timeMs, 2000);
  assert.deepEqual(
    inventoryPreview.tubes.slice(0, 3).map((tube) => tube.angleDeg),
    [-30, -20, -10],
  );
  assert.equal(inventoryPreview.tubes[1].name, 'Green Peony');
  assert.ok(inventoryPreview.tubes.every((tube) => tube.problem === null));
  assert.equal(previewCakeImport(fixture('finale-effects-sample.csv'), effects).kind, 'error');
  assert.match(previewCakeImport(inventory[2][1], effects).message, /Standard shapes/);
});
test('export uses one exact cake row and round trips all firing clocks, effects and whole-degree angles', () => {
  const rows = readCsv(fixture('finale-effects-sample.csv'));
  const imported = importedCakeDocument(exact(rows[1][1]).tubes, current);
  const exported = exportCakeInventory(imported, effects, metadata);
  const result = readCsv(exported);
  assert.deepEqual(result[0], [
    'partNumber',
    'description',
    'partType',
    'size',
    'duration',
    'numTubes',
    'vdl',
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[1][1], result[1][6]);
  assert.equal(result[1][3], '30mm');
  assert.equal(result[1][5], '21');
  assert.deepEqual(importedCakeDocument(exact(exported).tubes, current), imported);
  assert.equal(
    readCsv(exportCakeScript(imported, effects, metadata.partNumber)).at(-1)[0],
    '00:00:02.000',
  );
  assert.equal(
    readCsv(exportCakeInventory(imported, effects, { ...metadata, calibreMm: null }))[1][3],
    '',
  );
});
test('carry-over angle and gap, volleys and two-letter bindings retain exact millisecond timing', () => {
  const preview = exact(
    '4 Shot 1s (aa) Red Peony + (b) Green Peony Cake, 1 Row (-30aa250/b0/0aa/b/CAK)',
  );
  assert.deepEqual(
    preview.tubes.map((tube) => tube.timeMs),
    [0, 250, 250, 250],
  );
  assert.deepEqual(
    preview.tubes.map((tube) => tube.angleDeg),
    [-30, -30, 0, 0],
  );
  const document = importedCakeDocument(preview.tubes, current);
  assert.deepEqual(exact(exportCakeInventory(document, effects, metadata)).tubes, preview.tubes);
  assert.equal(exact('2 Shot 1s (a) Red Peony Cake, 1 Row (a/a/CAK)').tubes[1].timeMs, 500);
});
test('unknown and ambiguous names remain visible and cannot create an imported document', () => {
  const text = '1 Shot 0s (a) Missing Cake, 1 Row (0a/CAK)';
  const preview = exact(text);
  assert.equal(preview.tubes[0].problem, 'No catalogue match');
  assert.match(documentResult(preview.tubes, current).message, /catalogue match/);
  const duplicate = previewCakeImport(text.replace('Missing', 'Red Peony'), [
    ...effects,
    { ...effects[0], id: effects[1].id },
  ]);
  assert.equal(duplicate.tubes[0].problem, 'Ambiguous catalogue name');
});
test('malformed counts, ranges, row terminators, letter declarations and CSV quotes are refused', () => {
  for (const body of [
    '2 Shot 1s (a) Red Peony Cake, 1 Row (a/CAK)',
    '1 Shot 0s (a) Red Peony Cake, 1 Row (91a/CAK)',
    '1 Shot 0s (a) Red Peony Cake, 1 Row (a)',
    '1 Shot 0s (a) Red Peony Cake, 1 Row (b/CAK)',
    '1 Shot 0s (a) Red Peony Cake, 1 Row (a-5/CAK)',
    '"unfinished',
  ]) {
    assert.equal(previewCakeImport(body, effects).kind, 'error', body);
  }
  assert.deepEqual(readCsv(writeCsv([['a,b', 'a"b', 'line\r\nbreak']])), [
    ['a,b', 'a"b', 'line\r\nbreak'],
  ]);
  assert.throws(() => readCsv('"closed"extra'), /quoting/);
});
test('show script rounds clocks once, carries minutes and hours and keeps simultaneous order', () => {
  assert.equal(finaleTime(59999.6), '00:01:00.000');
  assert.equal(finaleTime(3599999.6), '01:00:00.000');
  assert.equal(finaleTime(360000001), '100:00:00.001');
  assert.throws(() => finaleTime(-1));
  assert.throws(() => finaleTime(NaN));
  const cues = [12000, 10000, 10000].map((timeMs, index) => ({
    timeMs,
    partNumber: String(index),
    description: 'Quoted, "shell"',
    position: 'Pos-01',
    angleDeg: -29.6,
  }));
  const csv = readCsv(exportShowScript(cues));
  assert.deepEqual(
    csv.slice(1).map((row) => row[1]),
    ['1', '2', '0'],
  );
  assert.equal(csv[1][4], '-30');
  assert.equal(csv[1][2], 'Quoted, "shell"');
});
test('lossy exports are refused and input documents stay unchanged', () => {
  const document = importedCakeDocument(
    exact('1 Shot 0s (a) Red Peony Cake, 1 Row (a/CAK)').tubes,
    current,
  );
  const before = structuredClone(document);
  exportCakeInventory(document, effects, metadata);
  assert.deepEqual(document, before);
  assert.match(inventoryResult(current, effects, metadata).message, /at least one/);
  assert.match(
    inventoryResult(
      { ...document, composition: { tubes: [{ ...document.composition.tubes[0], t_ms: 1 }] } },
      effects,
      metadata,
    ).message,
    /zero/,
  );
  const multibreak = structuredClone(effects);
  multibreak[0].document.breaks.push(structuredClone(multibreak[0].document.breaks[0]));
  assert.match(inventoryResult(document, multibreak, metadata).message, /single-break/);
});
