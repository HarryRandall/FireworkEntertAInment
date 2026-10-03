/** Project CPU simulation particles into bounded image descriptors without a DOM or GPU. */
import { simulate } from '@showcrafter/fireworks/sim';
import type { Design } from '@showcrafter/fireworks';
import type { Evidence, Feature } from './contracts';
import { rasterFrame, type RasterFrame } from './raster';

// Match the measurement clock, in Hz and milliseconds per second.
const FPS = 20;
const MS_PER_SECOND = 1000;
// Measurement trail and flicker proxies, dimensionless visual tuning from features.py.
const TRAIL_ASPECT = 2.5;
const FLICKER_CHANGE = 0.3;
const STROBE_CHANGES = 4;
const COLOUR_SAMPLE_FRAMES = 5;

function summarise(
  frames: readonly (RasterFrame | null)[],
  feature: Feature,
  start: number,
): Feature {
  const visible = frames.flatMap((frame, index) => (frame ? [{ frame, index }] : []));
  const peak = visible.reduce<(typeof visible)[number] | undefined>(
    (best, entry) =>
      !best || entry.frame.right - entry.frame.left > best.frame.right - best.frame.left
        ? entry
        : best,
    undefined,
  );
  if (!peak) {
    throw new Error('Simulation has no visible evidence');
  }
  const width = feature.content_box_px[2];
  const height = feature.content_box_px[3];
  const top = Math.min(...visible.map(({ frame }) => frame.top));
  const left = Math.min(...visible.map(({ frame }) => frame.left));
  const right = Math.max(...visible.map(({ frame }) => frame.right));
  const bottom = Math.max(...visible.map(({ frame }) => frame.bottom));
  const first = visible[0]?.index ?? 0;
  const last = visible.at(-1)?.index ?? first;
  const maxEnergy = Math.max(...visible.map(({ frame }) => frame.energy));
  const flickers = frames.filter(
    (frame, index) =>
      index > 0 &&
      Math.abs((frame?.energy ?? 0) - (frames[index - 1]?.energy ?? 0)) / maxEnergy >
        FLICKER_CHANGE,
  ).length;
  return {
    ...feature,
    apex_ratio: (height - top) / height,
    radius_ratio: (right - left + 1) / (2 * width),
    life_ms: ((last - first + 1) / FPS) * MS_PER_SECOND,
    trail_present: (bottom - top + 1) / Math.max(1, right - left + 1) >= TRAIL_ASPECT,
    trail_length_ratio:
      Math.max(
        0,
        ...visible
          .filter(({ index }) => index < Math.max(1, peak.index))
          .map(({ frame }) => frame.bottom - frame.top),
      ) / height,
    colours: peak.frame.colours,
    colours_over_time: frames.flatMap((frame, index) =>
      frame && index % COLOUR_SAMPLE_FRAMES === 0
        ? [{ t_ms: start + (index / FPS) * MS_PER_SECOND, colours: frame.colours }]
        : [],
    ),
    crackle: null,
    strobe: flickers >= STROBE_CHANGES,
    truncated: last === frames.length - 1,
  };
}

/** Render one measured shot window at 20 Hz from its onset; return normalised projected features.
 * Uses a fixed orthographic camera and CPU reference sprays, with no mutation of design or evidence.
 * Audio crackle cannot be observed from a silent simulation and remains null.
 */
export function renderFeatures(design: Design, evidence: Evidence, index: number): Feature {
  const shot = evidence.shots[index];
  const feature = evidence.features[index];
  if (!shot || !feature) {
    throw new Error('Measured shot required');
  }
  const end = evidence.shots[index + 1]?.t_ms ?? evidence.duration_ms;
  const frames = Array.from(
    { length: Math.ceil(((end - shot.t_ms) / MS_PER_SECOND) * FPS) },
    (_, frameIndex) =>
      rasterFrame(simulate(design, frameIndex / FPS, { smoke: false }), feature, shot.x),
  );
  return summarise(frames, feature, shot.t_ms);
}
