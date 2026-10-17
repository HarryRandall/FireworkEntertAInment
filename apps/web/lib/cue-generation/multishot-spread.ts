/** Spreads generated multishots across launch positions so cakes do not bunch on one rack. */
import { GENERATED_LAUNCH_INTERVAL_SECONDS } from './launch-spacing';
import { sustainedLayerSeconds } from './sustained-layers';

type SpreadableCue = { timeSeconds: number; tube: 0 | 1 | 2; productId: string };

type SpreadableProduct = {
  shotCount?: number | null;
  durationSeconds?: number | null;
};

/** Two-decimal rounding that mirrors the `numeric(8,2)` timeline column. */
function storedTime(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Planners put each cake on its musical slot's position, which often stacks
 * every multishot on one position. Moves each multishot, in time order, to the
 * position with the fewest cakes so far when its ignition window is free there
 * and no other cake is still firing from it, so cakes spread across the site
 * without displacing any other cue or stacking two running cakes on one rack.
 */
export function spreadMultishotPositions<T extends SpreadableCue>(
  cues: readonly T[],
  productById: ReadonlyMap<string, SpreadableProduct>,
  maxTubes: 1 | 2 | 3,
): T[] {
  const spread = cues.map((cue) => ({ ...cue }));
  const isCake = (cue: T) => (productById.get(cue.productId)?.shotCount ?? 1) > 1;
  const runEnd = (cue: T) =>
    storedTime(cue.timeSeconds) +
    sustainedLayerSeconds({
      durationSeconds: productById.get(cue.productId)?.durationSeconds ?? null,
    });
  const busy = (cake: T, tube: number) =>
    spread.some(
      (other) =>
        other !== cake &&
        other.tube === tube &&
        (Math.abs(storedTime(other.timeSeconds) - storedTime(cake.timeSeconds)) <
          GENERATED_LAUNCH_INTERVAL_SECONDS ||
          (isCake(other) &&
            storedTime(other.timeSeconds) < runEnd(cake) &&
            storedTime(cake.timeSeconds) < runEnd(other))),
    );
  const cakeCounts = Array.from({ length: maxTubes }, () => 0);
  const cakes = spread
    .filter(isCake)
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
