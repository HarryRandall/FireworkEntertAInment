/** Authored impact, lift and computed launch clocks, seconds from show start. */
export type ImpactTiming = {
  impactTimeSeconds: number;
  launchTimeSeconds: number;
  liftTimeSeconds: number;
};

// Half of the millisecond rounding quantum, seconds, retained from the timing contract.
const LAUNCH_ROUNDING_TOLERANCE_S = 0.0005;
// Three decimal places store seconds at millisecond precision.
const MILLISECOND_DECIMAL_PLACES = 3;
/** Computes a launch clock from finite non-negative impact and lift seconds; returns null if launch would precede show start. */
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
  if (launchTimeSeconds < -LAUNCH_ROUNDING_TOLERANCE_S) return null;

  return {
    impactTimeSeconds: roundMilliseconds(impactTimeSeconds),
    launchTimeSeconds: roundMilliseconds(Math.max(0, launchTimeSeconds)),
    liftTimeSeconds: roundMilliseconds(liftTimeSeconds),
  };
}

function roundMilliseconds(value: number): number {
  return Number(value.toFixed(MILLISECOND_DECIMAL_PLACES));
}
