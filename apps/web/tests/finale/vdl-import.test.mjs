import '../../../../scripts/renderer/register-typescript.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const { designSchema } = await import('@showcrafter/renderer');
const { parseVdlLine } = await import('../../lib/finale/vdl/line.ts');
const { decodeEncodedEffect } = await import('../../lib/finale/vdl/encoded.ts');
const { vdlGlossary, vdlTermSchema, BUILT_IN_VDL_TERMS } =
  await import('../../lib/finale/vdl/glossary.ts');
const { previewVdlCake, summariseVdlPreview } = await import('../../lib/finale/vdl/preview.ts');

const samples = readFileSync(new URL('./fixtures/vdl-samples.txt', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '');
const glossary = vdlGlossary();

function preview(line, existing = [], words = glossary) {
  const result = previewVdlCake(line, { glossary: words, existing });
  assert.equal(result.kind, 'preview', result.message);
  return result.preview;
}

test('every built-in word has a valid stored meaning', () => {
  for (const [phrase, term] of Object.entries(BUILT_IN_VDL_TERMS))
    assert.ok(vdlTermSchema.safeParse(term).success, phrase);
});

test('all 13 Finale sample lines build valid designs with no unknown words', () => {
  assert.equal(samples.length, 13);
  for (const line of samples) {
    const cake = parseVdlLine(line);
    assert.equal(cake.kind, 'cake', cake.message);
    assert.equal(cake.cake.tubes.length, cake.cake.shotCount, line.slice(0, 40));
    const result = preview(line);
    for (const part of result.parts) {
      assert.equal(part.error, null, `${line.slice(0, 30)} (${part.letter})`);
      assert.deepEqual(part.unknownWords, [], `${line.slice(0, 30)} (${part.letter})`);
      assert.ok(part.fireworks.length > 0);
    }
    for (const firework of Object.values(result.fireworks)) {
      assert.ok(designSchema.safeParse(firework.design).success, firework.name);
      assert.ok(firework.name.length <= 180);
    }
    assert.equal(result.shots[0].timeMs, 0);
    for (const [index, shot] of result.shots.entries()) {
      assert.ok(Math.abs(shot.angleDeg) <= 30);
      if (index > 0) assert.ok(shot.timeMs >= result.shots[index - 1].timeMs);
    }
  }
});

test('row syntax ignores the first delay and spreads each row over its duration', () => {
  const { cake } = parseVdlLine(samples[0]);
  assert.deepEqual(
    cake.tubes.map((tube) => [tube.letter, tube.timeMs]),
    [
      ['a', 0],
      ['b', 3600],
      ['a', 7200],
      ['b', 10800],
      ['a', 14400],
      ['b', 18000],
      ['a', 21000],
      ['b', 21200],
      ['a', 21400],
      ['b', 21600],
      ['a', 21800],
      ['b', 22000],
      ['a', 25000],
      ['b', 25200],
      ['a', 25400],
      ['b', 25600],
      ['a', 25800],
      ['b', 26000],
      ['c', 29000],
      ['c', 29000],
      ['c', 29000],
      ['c', 32000],
      ['c', 32000],
      ['c', 32000],
    ],
  );
});

test('fan rows sweep the default 60 degrees in firing order', () => {
  const { cake } = parseVdlLine(samples[11]);
  const row = (number) => cake.tubes.filter((tube) => tube.row === number);
  assert.equal(row(1)[0].angleDeg, -30);
  assert.equal(row(1).at(-1).angleDeg, 30);
  assert.equal(row(2)[0].angleDeg, 30);
  assert.deepEqual(
    row(7).map((tube) => [tube.timeMs, tube.angleDeg]),
    [
      [22000, -30],
      [22000, -10],
      [22000, 10],
      [22000, 30],
    ],
  );
});

test('encoded effects decode to Finale heights, lift, break size and star time', () => {
  const blob = samples[5].match(/\(a\) (\{[^}]+\})/)[1];
  const effect = decodeEncodedEffect(blob);
  assert.match(effect.phrase, /^shell thick long trail silver whirls tail to very small/);
  assert.equal(effect.caliberMm, 30);
  assert.equal(effect.heightM, 29.5);
  assert.equal(effect.liftS, 1.93);
  assert.equal(effect.breakRadiusM, 6.6);
  assert.equal(effect.starLifeS, 1.22);
  const part = preview(samples[5]).parts[0];
  assert.equal(part.encoded, true);
  const shell = preview(samples[5]).fireworks[part.fireworks[0]];
  assert.equal(shell.design.launch.height_m, 29.5);
  assert.equal(shell.design.launch.time_s, 1.93);
  assert.equal(shell.design.launch.tail, 'heli');
  assert.equal(shell.design.breaks[0].layers[0].radius_m, 6.6);
});

test('compound parts fire a firework per part from the same tube', () => {
  const result = preview(samples[7]);
  const first = result.shots.filter((shot) => shot.timeMs === 0 && shot.letter === 'a');
  assert.deepEqual(
    first.map((shot) => result.fireworks[shot.firework].family),
    ['comet', 'mine'],
  );
  assert.equal(new Set(first.map((shot) => shot.angleDeg)).size, 1);
});

test('stacked words keep three levels editable and bake the rest', () => {
  const result = preview(samples[11]);
  const tail = result.fireworks[result.parts[0].fireworks[0]];
  assert.equal(tail.design.adjustments['launch.tail'], -3);
  assert.ok(tail.design.breaks[0].layers.every((layer) => layer.hidden));
});

test('existing fireworks with the same name are reused', () => {
  const line = '30mm 2 Shot Cake (a) Red Peony + (b) Blue Peony, 1 Row (0a500/b/CAK)';
  const result = preview(line, [{ id: 'red-id', name: '30mm red peony' }]);
  assert.deepEqual(result.fireworks['30mm red peony'].match, {
    id: 'red-id',
    name: '30mm red peony',
  });
  assert.equal(result.fireworks['30mm blue peony'].match, null);
  const summary = summariseVdlPreview(result);
  assert.equal('design' in summary.fireworks['30mm blue peony'], false);
});

test('unknown words are reported without blocking, and saved words override built-ins', () => {
  const line = '30mm 1 Shot Cake (a) Sparkly Red Peony, 1 Row (0a/CAK)';
  const plain = preview(line);
  assert.deepEqual(plain.parts[0].unknownWords, ['Sparkly']);
  assert.equal(plain.fireworks[plain.parts[0].fireworks[0]].templateKey, 'peony');
  const custom = vdlGlossary([
    { phrase: 'Peony', definition: { type: 'effect', template: 'dahlia', family: 'shell' } },
  ]);
  const changed = preview(line, [], custom);
  assert.equal(changed.fireworks[changed.parts[0].fireworks[0]].templateKey, 'dahlia');
});

test('angles beyond the multishot limit are limited with a warning', () => {
  const result = preview('30mm 2 Shot Cake (a) Red Peony, 1 Row (-45a500/45a/CAK)');
  assert.deepEqual(
    result.shots.map((shot) => shot.angleDeg),
    [-30, 30],
  );
  assert.equal(result.warnings.length, 1);
});

test('malformed lines explain what is missing', () => {
  assert.match(parseVdlLine('Red Peony').message, /shot count/);
  assert.match(parseVdlLine('30mm 2 Shot Cake (a) Red Peony').message, /firing description/);
  assert.match(
    parseVdlLine('30mm 2 Shot Cake (a) Red Peony, 1 Row (0a500/b/CAK)').message,
    /\(b\)/,
  );
});
