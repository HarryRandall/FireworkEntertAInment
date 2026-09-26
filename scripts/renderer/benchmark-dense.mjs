import './register-typescript.mjs';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// CPU simulation only: excludes geometry uploads, WebGL, sound and snapshot caches.
// An optional extracted source directory permits comparisons without retaining an
// older renderer in the application. Both sources use the same installed dependencies.
const baselineSource = process.argv[2];
if (process.argv.length > 3) throw new Error('Usage: benchmark-dense.mjs [baseline-source]');
const sources = [{ name: 'current', path: resolve('packages/fireworks/src') }];
if (baselineSource) sources.push({ name: 'baseline', path: resolve(baselineSource) });
const seeds = [20260926, 41, 9701, 8675309, 123456789];
const families = ['brocade', 'willow', 'chrysanthemum', 'strobe', 'whirl', 'crossette'];
const fixtures = [
  { name: 'overlapping-24', cues: 24, spacingFrames: 12, frames: 1200 },
  { name: 'finale-72', cues: 72, spacingFrames: 3, frames: 1200 },
];
const capacity = 100_000;
const quantile = (values, fraction) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
};

for (const source of sources) {
  const read = (file) => import(pathToFileURL(resolve(source.path, file)).href);
  const [{ Effects }, { ParticlePool }, { compileFireworkDesign }, catalogue, random] =
    await Promise.all([
      read('Effects.ts'),
      read('ParticlePool.ts'),
      read('design.ts'),
      read('effect-catalogue.ts'),
      read('random.ts'),
    ]);
  const designs = families.map((slug) => {
    const effect = catalogue.FIREWORK_EFFECT_CATALOGUE.find((entry) => entry.slug === slug);
    if (!effect) throw new Error(`Missing catalogue effect: ${slug}`);
    return compileFireworkDesign({
      baseModel: catalogue.catalogueEffectModelJson(effect),
      primaryColor: effect.previewPalette[0],
    });
  });
  source.run = (fixture, seed) => {
    const pool = new ParticlePool(capacity);
    const effects = new Effects(pool, {}, { newLight() {}, setHemi() {} });
    let overwrittenLiveParticles = 0;
    const spawn = pool.new.bind(pool);
    pool.new = (properties) => {
      if (pool.particles[(pool.current + 1) % capacity].alive) overwrittenLiveParticles++;
      return spawn(properties);
    };
    let peakParticles = 0;
    let particleFrames = 0;
    const durations = [];
    const activeDurations = [];
    for (let frame = 0; frame < fixture.frames; frame++) {
      const started = performance.now();
      const cue = frame / fixture.spacingFrames;
      if (Number.isInteger(cue) && cue < fixture.cues) {
        pool.withHeadStyleSlot(cue * 2, () =>
          effects.fire(
            designs[cue % designs.length],
            { x: ((cue % 5) - 2) * 60, y: 0, z: 0 },
            { rng: random.createSeededRng((seed + cue * 2654435761) >>> 0), audible: false },
          ),
        );
      }
      // Match FireworksEngine.tickPhysics: children wait until the next tick.
      const count = pool.aliveCount;
      for (let slot = 0; slot < count; slot++) {
        const particle = pool.particles[pool.aliveIndices[slot]];
        if (!particle.alive) continue;
        pool.withHeadStyleSlot(particle.headStyleSlot, () =>
          particle.update(1 / 60, (frame + 1) / 60),
        );
      }
      pool.compactAliveMax();
      const duration = performance.now() - started;
      durations.push(duration);
      if (count > 0 || pool.aliveCount > 0) activeDurations.push(duration);
      peakParticles = Math.max(peakParticles, pool.aliveCount);
      particleFrames += pool.aliveCount;
    }
    return {
      medianSimulationMs: quantile(durations, 0.5),
      p95SimulationMs: quantile(durations, 0.95),
      medianActiveSimulationMs: quantile(activeDurations, 0.5),
      activeFrames: activeDurations.length,
      peakParticles,
      particleFrames,
      overwrittenLiveParticles,
      remainingParticles: pool.aliveCount,
    };
  };
}

// Warm both implementations before measurement and alternate their order to
// reduce order bias. Keep every run rather than concealing noisy timings.
for (const source of sources) source.run(fixtures[0], seeds[0]);
const results = [];
for (const fixture of fixtures) {
  for (let index = 0; index < seeds.length; index++) {
    for (const source of index % 2 ? sources.toReversed() : sources) {
      results.push({
        source: source.name,
        fixture: fixture.name,
        seed: seeds[index],
        ...source.run(fixture, seeds[index]),
      });
      console.error(`Captured ${source.name}: ${fixture.name}, seed ${seeds[index]}`);
    }
  }
}
console.log(
  JSON.stringify(
    {
      environment: { node: process.version, platform: process.platform, cpu: cpus()[0].model },
      scope: 'CPU simulation, not end-to-end frame or GPU performance',
      capacity,
      families,
      fixtures,
      results,
    },
    null,
    2,
  ),
);
