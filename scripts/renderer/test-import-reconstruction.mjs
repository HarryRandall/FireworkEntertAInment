import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseImportReconstruction } from '../../apps/web/lib/firework-import/reconstruction.ts';
import { starEmissionCount } from '../../packages/fireworks/src/emission.ts';
import { effectFire } from '../../packages/fireworks/src/effects/launch.ts';
import { ParticlePool } from '../../packages/fireworks/src/ParticlePool.ts';
import { createSeededRng } from '../../packages/fireworks/src/random.ts';
import { RENDERER_GEOMETRIES } from '../../packages/fireworks/src/behaviours.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const localPython = `${root}services/firework-import-worker/.venv/bin/python`;
const python = process.env.PYTHON ?? (existsSync(localPython) ? localPython : 'python');
const result = spawnSync(
  python,
  ['services/firework-import-worker/tests/renderer_contract_cases.py'],
  { cwd: root, encoding: 'utf8', maxBuffer: 5_000_000 },
);
assert.equal(result.status, 0, result.error?.message ?? result.stderr);
const inputs = JSON.parse(result.stdout);
const designs = inputs.map((input) => {
  const parsed = parseImportReconstruction(input);
  assert.equal(parsed.success, true, JSON.stringify(parsed.issues));
  return parsed.data.designs[0].design;
});
assert.deepEqual(new Set(designs.map((design) => design.geometry)), new Set(RENDERER_GEOMETRIES));
assert.equal(
  designs[inputs.findIndex((input) => input.designs[0].effectSlug === 'pistil')].stars.core.enabled,
  true,
);

function emittedStars(design) {
  const pp = new ParticlePool(12000);
  const allocate = pp.new.bind(pp);
  let count = 0;
  pp.new = (options) => {
    if (options.shape >= 2 && options.shape < 3) count++;
    return allocate(options);
  };
  effectFire(
    { pp, sh: {}, lights: { newLight() {}, setHemi() {} }, audible: false },
    design,
    { x: 0, y: 100, z: 0 },
    { rng: createSeededRng(987), audible: false },
  );
  const duration =
    design.geometry === 'fountain'
      ? design.geometryTuning.fountain.durationSeconds
      : design.geometryTuning.romanCandle.durationSeconds;
  for (let frame = 0; frame / 60 < duration + 2; frame++) {
    const slots = [...pp.aliveIndices.slice(0, pp.aliveCount)];
    for (const slot of slots) pp.particles[slot].update(1 / 60, frame / 60);
    pp.compactAliveMax();
  }
  return count;
}

const fountains = designs.filter((design) => design.geometry === 'fountain');
assert.deepEqual(
  fountains.map((design) => [
    design.stars.outer.emissionRate,
    design.geometryTuning.fountain.durationSeconds,
  ]),
  [
    [12.5, 3.25],
    [25, 3.25],
    [12.5, 3.5],
    [600, 0.25],
  ],
);
for (const design of fountains) {
  assert.equal(emittedStars(design), starEmissionCount(design, 'outer'));
}
const roman = designs.find((design) => design.geometry === 'roman_candle');
assert.equal(roman.stars.outer.count, 4);
assert.equal(roman.geometryTuning.romanCandle.durationSeconds, 4);
assert.equal(emittedStars(roman), 4);
console.log(
  'Verified 19 worker geometries through strict app validation and independent ground emissions.',
);
