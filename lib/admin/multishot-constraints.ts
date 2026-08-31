export const MULTISHOT_PAN_LIMIT_DEGREES = 30;
export const MULTISHOT_TILT_LIMIT_DEGREES = 50;
export const MULTISHOT_MAX_DURATION_SECONDS = 3600;
export const MULTISHOT_MAX_SHOT_COUNT = 2000;
export const MULTISHOT_MAX_TRACK_COUNT = MULTISHOT_MAX_SHOT_COUNT;
export const MULTISHOT_NAME_MAX_LENGTH = 180;
// Supplier imports contain detailed effect sequences; the linked database has
// legitimate descriptions above 3,000 characters.
export const MULTISHOT_DESCRIPTION_MAX_LENGTH = 5000;
export const MULTISHOT_CALIBER_MAX_LENGTH = 40;
export const MULTISHOT_NOTES_MAX_LENGTH = 500;

function clampSignedDegrees(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

export function clampMultishotPanDegrees(value: number): number {
  return clampSignedDegrees(value, MULTISHOT_PAN_LIMIT_DEGREES);
}

export function clampMultishotTiltDegrees(value: number): number {
  return clampSignedDegrees(value, MULTISHOT_TILT_LIMIT_DEGREES);
}

export function clampMultishotTimeSeconds(value: number): number {
  return Math.max(0, Math.min(MULTISHOT_MAX_DURATION_SECONDS, value));
}

export function clampMultishotTrackIndex(value: number): number {
  return Math.max(0, Math.min(MULTISHOT_MAX_TRACK_COUNT - 1, Math.floor(value)));
}
