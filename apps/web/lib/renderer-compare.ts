/** One old-renderer setting that needs an owner's visual review. */
export type UnmatchedSetting = { path: string; value: unknown };

/** Lists every explicit override leaf; old simulation tuning has no exact v1 conversion. */
export function unmatchedRendererSettings(settings: unknown, prefix = ''): UnmatchedSetting[] {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    return prefix ? [{ path: prefix, value: settings }] : [];
  }
  return Object.entries(settings).flatMap(([key, value]) =>
    unmatchedRendererSettings(value, prefix ? `${prefix}.${key}` : key),
  );
}
