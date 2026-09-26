import './register-typescript.mjs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Effects } from '../../packages/fireworks/src/Effects.ts';
import { ParticlePool } from '../../packages/fireworks/src/ParticlePool.ts';
import { compileFireworkDesign } from '../../packages/fireworks/src/design.ts';
import {
  FIREWORK_EFFECT_CATALOGUE,
  catalogueEffectModelJson,
} from '../../packages/fireworks/src/effect-catalogue.ts';
import { createSeededRng } from '../../packages/fireworks/src/random.ts';
import { estimateFireworkDesignTiming } from '../../packages/fireworks/src/timing.ts';

export function captureSeededBaseline() {
  const records = [];
  for (const effect of FIREWORK_EFFECT_CATALOGUE) {
    const design = compileFireworkDesign({
      baseModel: catalogueEffectModelJson(effect),
      primaryColor: effect.previewPalette[0],
    });
    const pool = new ParticlePool(100_000);
    const effects = new Effects(pool, {}, { newLight() {}, setHemi() {} });
    effects.fire(design, { x: 0, y: 0, z: 0 }, { rng: createSeededRng(20260926), audible: false });
    const hash = createHash('sha256');
    let peakParticles = 0;
    const started = performance.now();
    for (let frame = 0; frame < 720; frame++) {
      for (let slot = 0; slot < pool.aliveCount; slot++) {
        pool.particles[pool.aliveIndices[slot]].update(1 / 60, frame / 60);
      }
      pool.compactAliveMax();
      peakParticles = Math.max(peakParticles, pool.aliveCount);
      if (frame % 30 === 0) {
        for (let slot = 0; slot < pool.aliveCount; slot++) {
          const p = pool.particles[pool.aliveIndices[slot]];
          hash.update(
            JSON.stringify(
              [
                p.x,
                p.y,
                p.z,
                p.vx,
                p.vy,
                p.vz,
                p.life,
                p.size,
                p.color.r,
                p.color.g,
                p.color.b,
                p.alpha,
                p.shape,
              ].map((v) => Math.round(v * 1e6) / 1e6),
            ),
          );
        }
      }
    }
    records.push({
      slug: effect.slug,
      hash: hash.digest('hex'),
      peakParticles,
      timing: estimateFireworkDesignTiming(design),
      simulationMs: Math.round(performance.now() - started),
    });
  }
  return records;
}

if (process.argv[1]?.endsWith('/seeded-baseline.mjs'))
  console.log(JSON.stringify(captureSeededBaseline(), null, 2));
