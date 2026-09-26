export type RecordLike = Record<string, unknown>;

export function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMergeDesign(base: unknown, override: unknown): unknown {
  if (!isRecord(base)) return override;
  if (!isRecord(override)) return base;
  const merged: RecordLike = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] =
      isRecord(value) && isRecord(merged[key]) ? deepMergeDesign(merged[key], value) : value;
  }
  return merged;
}
