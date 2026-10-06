/** Capture independent prototype catalogue metadata and full simulation samples. */
import { writeFileSync } from 'node:fs';
import { loadReference, referenceFrame } from './template-reference.mjs';

const path = process.argv[2];
if (!path) throw new Error('Pass the absolute path to the read-only reference fireworks3d.js');
const ref = loadReference(path);
// Single-effect showcase playback seed, matching the converted catalogue documents.
const TEMPLATE_SEED = 11;
// Seconds from firing for climb, then offsets after apex for developed and late shells.
const CLIMB_SAMPLE_S = 0.53;
const BURST_OFFSETS_S = [0.03, 0.83, 2.3];
// Ground samples cover start-up, established sprays and fading tails.
const GROUND_SAMPLES_S = [0.53, 1.7, 3.83, 7.3];
const templates = Object.keys(ref.PRESETS).map((key) => {
  const d = ref.design(key);
  const times = ['shell', 'mine'].includes(d.kind)
    ? [CLIMB_SAMPLE_S, ...BURST_OFFSETS_S.map((t) => t + (d.kind === 'mine' ? 0 : d.launch.time))]
    : GROUND_SAMPLES_S;
  return {
    key,
    name: d.name,
    group: d.group,
    frames: times.map((t) => referenceFrame(ref, d, TEMPLATE_SEED, t)),
  };
});
writeFileSync(
  new URL('../tests/fixtures/template-goldens.json', import.meta.url),
  `${JSON.stringify(
    {
      source: 'prototype/fireworks3d.js',
      source_sha256: ref.source_sha256,
      scope:
        'Original design(key) and full simulation, including sprays, smoke and launch effects.',
      templates,
    },
    null,
    2,
  )}\n`,
);
console.log(`Captured ${templates.length} templates`);
