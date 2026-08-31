/**
 * Minimum separation between independent ignitions assigned to the same
 * launch position. Visual effects may continue after this interval.
 *
 * This is deliberately separate from catalogue display and multishot
 * durations: those describe what remains visible, not when another separately
 * wired product at the same position may be fired.
 */
export const GENERATED_LAUNCH_INTERVAL_SECONDS = 0.5;
