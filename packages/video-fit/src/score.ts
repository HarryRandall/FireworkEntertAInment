/** Bounded distances between measured and CPU-rendered image descriptors. */
import type { Feature } from './contracts';

// Normalise life error against one second at minimum, avoiding large penalties on short clips.
const LIFE_FLOOR_MS = 1000;
// Equal weights are an initial visual judgement; scores are similarities, not probabilities.
const MAX_DISTANCE = 1;
const MIN_DISTANCE = 0;

/** Feature distances in [0,1] and mean similarity in [0,1], with unobservable audio excluded. */
export interface Score {
  distances: Record<string, number | null>;
  overall: number;
}

function colourDistance(observed: Feature['colours'], rendered: Feature['colours']): number | null {
  if (observed.length === 0) {
    return null;
  }
  if (rendered.length === 0) {
    return MAX_DISTANCE;
  }
  const distances = observed.map((swatch) =>
    Math.min(
      ...rendered.map((candidate) =>
        Math.max(
          ...swatch.rgb.map((channel, index) => Math.abs(channel - (candidate.rgb[index] ?? 0))),
        ),
      ),
    ),
  );
  return distances.reduce((sum, value, index) => sum + value * (observed[index]?.fraction ?? 0), 0);
}

/** Compare feature ratios and clocks; truncated life is a lower bound, not an exact lifetime.
 * The output never mutates features; audio crackle is explicitly unscored.
 */
export function scoreFeatures(observed: Feature, rendered: Feature): Score {
  const temporalColours = observed.colours_over_time.flatMap((sample) => {
    const match = rendered.colours_over_time.find((entry) => entry.t_ms === sample.t_ms);
    const distance = colourDistance(sample.colours, match?.colours ?? []);
    return distance === null ? [] : [distance];
  });
  const lifeDifference = rendered.life_ms - observed.life_ms;
  const distances: Score['distances'] = {
    apex: Math.abs(observed.apex_ratio - rendered.apex_ratio),
    radius: Math.abs(observed.radius_ratio - rendered.radius_ratio),
    life:
      Math.abs(observed.truncated ? Math.min(0, lifeDifference) : lifeDifference) /
      Math.max(LIFE_FLOOR_MS, observed.life_ms),
    trail: observed.trail_present === rendered.trail_present ? 0 : 1,
    trail_length: Math.abs(observed.trail_length_ratio - rendered.trail_length_ratio),
    colour: colourDistance(observed.colours, rendered.colours),
    colour_over_time:
      temporalColours.length > 0
        ? temporalColours.reduce((sum, value) => sum + value, 0) / temporalColours.length
        : null,
    strobe: observed.strobe === rendered.strobe ? 0 : 1,
    crackle: null,
  };
  const bounded = Object.fromEntries(
    Object.entries(distances).map(([key, value]) => [
      key,
      value === null ? null : Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, value)),
    ]),
  );
  const values = Object.values(bounded).filter((value): value is number => value !== null);
  return {
    distances: bounded,
    overall: 1 - values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}
