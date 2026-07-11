export type ImpactTiming = {
  impactTimeSeconds: number;
  launchTimeSeconds: number;
  liftTimeSeconds: number;
};

/** Pure launch clock calculation, kept separate for direct behavioural tests. */
export function scheduleImpactWithLift(
  impactTimeSeconds: number,
  liftTimeSeconds: number,
): ImpactTiming | null {
  if (
    !Number.isFinite(impactTimeSeconds) ||
    impactTimeSeconds < 0 ||
    !Number.isFinite(liftTimeSeconds) ||
    liftTimeSeconds < 0
  ) {
    return null;
  }

  const launchTimeSeconds = impactTimeSeconds - liftTimeSeconds;
  if (launchTimeSeconds < -0.0005) return null;

  return {
    impactTimeSeconds: roundMilliseconds(impactTimeSeconds),
    launchTimeSeconds: roundMilliseconds(Math.max(0, launchTimeSeconds)),
    liftTimeSeconds: roundMilliseconds(liftTimeSeconds),
  };
}

function roundMilliseconds(value: number): number {
  return Number(value.toFixed(3));
}
