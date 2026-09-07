export const CALIBRATED_APPEARANCE_MIN = 0;
export const CALIBRATED_APPEARANCE_DEFAULT = 50;
export const CALIBRATED_APPEARANCE_MAX = 100;
export const CALIBRATED_APPEARANCE_STEP = 1;

export type CalibratedRange = {
  min: number;
  defaultValue: number;
  max: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function withCalibrationDefault(range: CalibratedRange, value: unknown): CalibratedRange {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return range;

  return {
    ...range,
    defaultValue: Math.min(range.max, Math.max(range.min, raw)),
  };
}

export function rawToCalibrated(value: number, range: CalibratedRange): number {
  const bounded = Math.min(range.max, Math.max(range.min, value));
  if (bounded <= range.defaultValue) {
    const lowerSpan = range.defaultValue - range.min;
    return lowerSpan <= 0
      ? CALIBRATED_APPEARANCE_DEFAULT
      : round2(((bounded - range.min) / lowerSpan) * CALIBRATED_APPEARANCE_DEFAULT);
  }

  const upperSpan = range.max - range.defaultValue;
  return upperSpan <= 0
    ? CALIBRATED_APPEARANCE_DEFAULT
    : round2(
        CALIBRATED_APPEARANCE_DEFAULT +
          ((bounded - range.defaultValue) / upperSpan) * CALIBRATED_APPEARANCE_DEFAULT,
      );
}

export function calibratedToRaw(value: number, range: CalibratedRange): number {
  const bounded = Math.min(CALIBRATED_APPEARANCE_MAX, Math.max(CALIBRATED_APPEARANCE_MIN, value));

  if (bounded <= CALIBRATED_APPEARANCE_DEFAULT) {
    return round2(
      range.min + (bounded / CALIBRATED_APPEARANCE_DEFAULT) * (range.defaultValue - range.min),
    );
  }

  return round2(
    range.defaultValue +
      ((bounded - CALIBRATED_APPEARANCE_DEFAULT) / CALIBRATED_APPEARANCE_DEFAULT) *
        (range.max - range.defaultValue),
  );
}
