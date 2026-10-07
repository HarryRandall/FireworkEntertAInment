/** Keep the declared musical length separate from the replay's fade buffer. */

/** A declared length wins over inferred ignition times and preview padding. */
export function declaredShowLengthSeconds(declared: number | null, inferred: number): number {
  return declared != null && Number.isFinite(declared) && declared > 0 ? declared : inferred;
}

/** Preserve explicit fixed lengths while keeping old estimated lengths subordinate to analysis. */
export function generationDurationSeconds(
  analysedSeconds: number | null | undefined,
  requestedSeconds: number | null | undefined,
  explicitFixedLength = false,
): number {
  return (
    (explicitFixedLength ? requestedSeconds : analysedSeconds) ??
    requestedSeconds ??
    analysedSeconds ??
    0
  );
}
