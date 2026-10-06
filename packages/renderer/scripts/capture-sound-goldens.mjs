/** One-off acoustic reference capture; reads the prototype and writes only local test fixtures. */
import { writeFileSync } from 'node:fs';
import { loadReference } from './template-reference.mjs';
const path = process.argv[2];
if (!path) throw new Error('Pass the absolute path to the reference fireworks3d.js');
const reference = loadReference(path);
const listener = [0, 1.7, 100];
const templates = Object.keys(reference.PRESETS).map((key) => ({
  key,
  events: reference
    .soundEvents([{ design: reference.design(key), t0: 0, pos: [0, 0] }])
    .map((event) => ({
      time_s: event.t,
      kind: event.type,
      position: event.pos,
      distance_m: Math.hypot(...event.pos.map((value, axis) => value - listener[axis])),
      duration_s: event.dur ?? 0,
      size: event.size ?? 1,
      quiet: event.quiet ?? false,
      heavy: event.heavy ?? false,
      loud: event.loud ?? false,
      soft: event.soft ?? false,
    })),
}));
writeFileSync(
  new URL('../tests/fixtures/sound-goldens.json', import.meta.url),
  `${JSON.stringify({ source: 'prototype/fireworks3d.js', source_sha256: reference.source_sha256, listener, templates }, null, 2)}\n`,
);
