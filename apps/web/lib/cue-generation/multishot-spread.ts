/** Spreads generated multishots across launch positions so cakes do not bunch on one rack. */
import { GENERATED_LAUNCH_INTERVAL_SECONDS } from './launch-spacing';

type SpreadableCue = { timeSeconds: number; tube: 0 | 1 | 2; productId: string };

/** Two-decimal rounding that mirrors the `numeric(8,2)` timeline column. */
function storedTime(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Planners put each cake on its musical slot's position, which often stacks
 * every multishot on one position. Moves each multishot, in time order, to the
 * position with the fewest cakes so far when its ignition window is free there,
 * so cakes spread across the site without displacing any other cue.
 */
export function spreadMultishotPositions<T extends SpreadableCue>(
  cues: readonly T[],
  productById: ReadonlyMap<string, { shotCount?: number | null }>,
  maxTubes: 1 | 2 | 3,
): T[] {
  const spread = cues.map((cue) => ({ ...cue }));
  const busy = (cake: T, tube: number) =>
    spread.some(
      (other) =>
        other !== cake &&
        other.tube === tube &&
        Math.abs(storedTime(other.timeSeconds) - storedTime(cake.timeSeconds)) <
          GENERATED_LAUNCH_INTERVAL_SECONDS,
    );
  const cakeCounts = Array.from({ length: maxTubes }, () => 0);
  const cakes = spread
    .filter((cue) => (productById.get(cue.productId)?.shotCount ?? 1) > 1)
    .sort((a, b) => a.timeSeconds - b.timeSeconds || a.tube - b.tube);
  for (const cake of cakes) {
    if (cake.tube >= maxTubes) continue;
    const tubes = Array.from({ length: maxTubes }, (_, tube) => tube as 0 | 1 | 2).sort(
      (a, b) => cakeCounts[a] - cakeCounts[b] || Number(b === cake.tube) - Number(a === cake.tube),
    );
    const tube = tubes.find((candidate) => candidate === cake.tube || !busy(cake, candidate));
    if (tube == null) continue;
    cake.tube = tube;
    cakeCounts[tube]++;
  }
  return spread;
}
