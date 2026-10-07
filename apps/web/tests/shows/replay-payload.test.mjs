import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(relative, transform = (source) => source) {
  const source = transform(await readFile(new URL(relative, import.meta.url), 'utf8'));
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { normaliseReplayCues, rehydrateReplayCues } = await load(
  '../../lib/shows/replay-payload.ts',
);
const fireworks = Array.from({ length: 5 }, (_, i) => ({
  id: `firework-${i}`,
  slug: `slug-${i}`,
  name: `Name ${i}`,
  description: 'Description',
  sortOrder: i,
  durationSeconds: 3,
  occupancyDurationSeconds: 4,
  heightMeters: 50,
  caliber: '75mm',
  shotCount: 1,
  manufacturer: 'Maker',
  minPriceCents: 500,
  previewImagePath: 'poster.webp',
  previewImageRevision: 2,
  kind: 'shell',
  designError: null,
  hasLaunchPositionOverrides: true,
  launchPositionOverrideIndices: [1, 2],
  design: { kind: 'shell', fixture: 'd'.repeat(12000) },
  spec: { fixture: 's'.repeat(12000) },
  rawSpec: { fixture: 'r'.repeat(12000) },
  renderDesign: { fixture: 'l'.repeat(12000) },
  baseEffect: { id: 'effect', slug: 'effect', name: 'Effect', patternKey: 'sphere' },
  variant: {
    id: `variant-${i}`,
    slug: 'variant',
    primaryColor: '#fff',
    secondaryColor: null,
    colorPalette: ['#fff'],
  },
}));
const cues = Array.from({ length: 500 }, (_, i) => ({
  id: `cue-${i}`,
  position: i,
  timeSeconds: i / 2,
  description: 'Cue',
  productId: `product-${i % 5}`,
  seedOverride: i,
  launchPositionIndex: i % 3,
  emphasis: 'peak',
  firework: fireworks[i % 5],
  shotPanDegrees: 15,
  shotTiltDegrees: 10,
  shotPositionOverride: { x: 1, y: 2, z: 3 },
}));

test('JSON round trip preserves every current field and shares firework objects', () => {
  const payload = normaliseReplayCues(cues);
  const restored = rehydrateReplayCues(JSON.parse(JSON.stringify(payload)));
  assert.deepEqual(
    restored,
    cues.map((cue) => ({
      ...cue,
      firework: {
        ...cue.firework,
        spec: null,
        rawSpec: null,
        renderDesign: null,
      },
    })),
  );
  assert.equal(restored[0].firework, restored[5].firework);
  const changed = { ...cues[0], firework: { ...fireworks[0], caliber: '50mm', sortOrder: 99 } };
  const variants = rehydrateReplayCues(normaliseReplayCues([cues[0], changed]));
  assert.equal(variants[1].firework.caliber, '50mm');
  assert.equal(variants[1].firework.sortOrder, 99);
  assert.throws(
    () => rehydrateReplayCues({ cues: [{ fireworkId: 'missing' }], fireworks: {} }),
    /Missing replay firework/,
  );
});

test('500 cues carry five designs rather than 500 copies', () => {
  const payload = normaliseReplayCues(cues);
  assert.equal(Object.keys(payload.fireworks).length, 5);
  const before = Buffer.byteLength(JSON.stringify(cues));
  const after = Buffer.byteLength(JSON.stringify(payload));
  const refs = Buffer.byteLength(JSON.stringify(payload.cues));
  assert.ok(after - refs < 5 * 14000);
  assert.ok(after < before / 100);
  console.log(`Replay fixture: before=${before} bytes after=${after} bytes`);
});

test('cache guard skips oversized writes and warns once per key', async () => {
  const writes = [];
  const warnings = [];
  globalThis.__replayCacheWrites = writes;
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const cache = await load('../../lib/server-cache.ts', (source) =>
      source
        .replace("import 'server-only';", '')
        .replace("import { Redis } from '@upstash/redis';", '')
        .replace(
          /const redis = redisConfig[^;]+;/,
          'const redis = { set: async (...args) => globalThis.__replayCacheWrites.push(args) };',
        ),
    );
    const oversized = '"'.repeat(6 * 1024 * 1024);
    await cache.setCachedJson('oversized', oversized);
    await cache.setCachedJson('oversized', oversized);
    assert.equal(writes.length, 0);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0][1].key, 'oversized');
    assert.ok(warnings[0][1].requestBytes > 10 * 1024 * 1024);
    await cache.setCachedJson('small', { name: '£🎆' }, 30);
    assert.deepEqual(writes, [['small', { name: '£🎆' }, { ex: 30 }]]);
  } finally {
    console.warn = originalWarn;
    delete globalThis.__replayCacheWrites;
  }
});
